/**
 * rgpd.service.ts — data-subject rights (RGPD/GDPR): export (Art. 15 & 20) and
 * erasure (Art. 17). Admin-triggered in this first sub-lot; learner self-service
 * comes later. Every action is written to the audit log for accountability.
 */
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { audit } from "../../lib/audit.js";
import { anonymizedUserPatch, retentionCutoff } from "../../domain/rgpd.js";

const DAY_MS = 86_400_000;

export class RgpdError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

export type EraseMode = "anonymize" | "delete";

/** Everything we hold about a user, as a portable JSON document (Art. 15 & 20). */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new RgpdError(404, "not_found", "Utilisateur introuvable");

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      badges: true, completions: true, reEngagements: true, credentials: true,
      journalTriggers: true, mediaPositions: true, projectSubmission: true,
      tutorSessions: { include: { messages: true } },
    },
  });
  const [threads, posts, orgMemberships, cohortMemberships, sessionRegistrations, auditTrail] = await Promise.all([
    prisma.forumThread.findMany({ where: { authorId: userId } }),
    prisma.forumPost.findMany({ where: { authorId: userId } }),
    prisma.organizationMembership.findMany({ where: { userId }, include: { organization: { select: { id: true, name: true } } } }),
    prisma.cohortMembership.findMany({ where: { userId } }),
    prisma.sessionRegistration.findMany({ where: { userId } }),
    prisma.auditLog.findMany({ where: { actorId: userId }, orderBy: { at: "desc" }, take: 2000, select: { action: true, ip: true, at: true, targetType: true, targetId: true } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: "kd-hcblm-rgpd-export-v1",
    subject: {
      id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone,
      emailVerifiedAt: user.emailVerifiedAt, twoFactorEnabled: !!user.totpEnabledAt,
      disabledAt: user.disabledAt, anonymizedAt: user.anonymizedAt, createdAt: user.createdAt, updatedAt: user.updatedAt,
    },
    enrollments,
    forum: { threads, posts },
    organizationMemberships: orgMemberships,
    cohortMemberships,
    liveSessionRegistrations: sessionRegistrations,
    auditTrail,
  };
}

/**
 * Schedule an erasure (Art. 17), reversibly. The account is blocked at once
 * (disabled + sessions revoked) but data is destroyed only after the grace
 * period, by the retention job. `mode` is remembered for that moment. An admin
 * can restore until then. Self-erasure is refused (an admin acts on another).
 */
async function doSchedule(actorId: string | undefined, userId: string, mode: EraseMode, ip: string | undefined, action: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, anonymizedAt: true } });
  if (!user) throw new RgpdError(404, "not_found", "Utilisateur introuvable");
  if (user.anonymizedAt) throw new RgpdError(409, "already_purged", "Compte déjà anonymisé");
  const now = new Date();
  await prisma.$transaction([
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: now, deletionMode: mode, disabledAt: now } }),
  ]);
  await audit({ actorId, action, ip, targetType: "user", targetId: userId, meta: { mode, graceDays: env.RGPD_GRACE_DAYS } });
  return { scheduled: true, mode, userId, purgeAt: new Date(now.getTime() + env.RGPD_GRACE_DAYS * DAY_MS) };
}

/** Admin schedules another account's erasure (self-erasure refused — use the self route). */
export async function scheduleErasure(actorId: string | undefined, userId: string, mode: EraseMode, ip?: string) {
  if (actorId && actorId === userId) throw new RgpdError(400, "self_erase", "Vous ne pouvez pas effacer votre propre compte ici");
  return doSchedule(actorId, userId, mode, ip, "rgpd.erase.scheduled");
}

/** Learner self-service: request erasure of one's own account (Art. 17). */
export async function requestOwnErasure(userId: string, mode: EraseMode, ip?: string) {
  return doSchedule(userId, userId, mode, ip, "rgpd.erase.self_requested");
}

/** Cancel a scheduled erasure before it is purged (un-block the account). */
export async function restoreUser(actorId: string | undefined, userId: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, deletionRequestedAt: true, anonymizedAt: true } });
  if (!user) throw new RgpdError(404, "not_found", "Utilisateur introuvable");
  if (user.anonymizedAt) throw new RgpdError(409, "already_purged", "Compte déjà anonymisé — restauration impossible");
  if (!user.deletionRequestedAt) throw new RgpdError(400, "not_scheduled", "Aucune suppression programmée pour ce compte");
  await prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: null, deletionMode: null, disabledAt: null } });
  await audit({ actorId, action: "rgpd.erase.restored", ip, targetType: "user", targetId: userId });
  return { restored: true, userId };
}

/**
 * Retention/purge job (cron-driven). Executes due erasures (grace period over),
 * then housekeeps spent tokens, stale audit logs (which hold IPs) and expired
 * verification codes. Windows are configurable via env. Idempotent and safe to
 * run repeatedly. Returns per-category counts.
 */
export async function runRetentionPurge(now: Date = new Date()) {
  // 1) Carry out scheduled erasures whose grace period has elapsed.
  const due = await prisma.user.findMany({
    where: { deletionRequestedAt: { lte: retentionCutoff(now, env.RGPD_GRACE_DAYS) } },
    select: { id: true, deletionMode: true },
  });
  let anonymized = 0, deleted = 0;
  for (const u of due) {
    if (u.deletionMode === "delete") {
      await prisma.user.delete({ where: { id: u.id } });
      deleted++;
    } else {
      await prisma.$transaction([
        prisma.refreshToken.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: now } }),
        prisma.device.deleteMany({ where: { userId: u.id } }), // stop pushing to an anonymised account
        prisma.user.update({ where: { id: u.id }, data: { ...anonymizedUserPatch(u.id, now), deletionRequestedAt: null, deletionMode: null } }),
      ]);
      anonymized++;
    }
    await audit({ action: "rgpd.erase.executed", targetType: "user", targetId: u.id, meta: { mode: u.deletionMode ?? "anonymize" } });
  }

  // 2) Housekeeping.
  const tokens = await prisma.refreshToken.deleteMany({
    where: { createdAt: { lt: retentionCutoff(now, env.TOKEN_RETENTION_DAYS) }, OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }] },
  });
  const audits = await prisma.auditLog.deleteMany({ where: { at: { lt: retentionCutoff(now, env.AUDIT_RETENTION_DAYS) } } });
  const codes = await prisma.verificationCode.deleteMany({ where: { expiresAt: { lt: now } } });

  return { erasuresExecuted: due.length, anonymized, deleted, tokensPurged: tokens.count, auditPurged: audits.count, codesPurged: codes.count };
}
