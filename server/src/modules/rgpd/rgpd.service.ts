/**
 * rgpd.service.ts — data-subject rights (RGPD/GDPR): export (Art. 15 & 20) and
 * erasure (Art. 17). Admin-triggered in this first sub-lot; learner self-service
 * comes later. Every action is written to the audit log for accountability.
 */
import { prisma } from "../../db/prisma.js";
import { audit } from "../../lib/audit.js";
import { anonymizedUserPatch } from "../../domain/rgpd.js";

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
 * Erase a user (Art. 17). `anonymize` scrubs direct identifiers and revokes
 * sessions but keeps the de-identified row + learning history; `delete` cascades
 * a hard delete. Self-erasure is refused (an admin acts on another account).
 */
export async function eraseUser(actorId: string | undefined, userId: string, mode: EraseMode, ip?: string) {
  if (actorId && actorId === userId) throw new RgpdError(400, "self_erase", "Vous ne pouvez pas effacer votre propre compte ici");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) throw new RgpdError(404, "not_found", "Utilisateur introuvable");

  if (mode === "delete") {
    await prisma.user.delete({ where: { id: userId } }); // cascades sessions/enrolments; authored content → SetNull
    await audit({ actorId, action: "rgpd.erase.delete", ip, targetType: "user", targetId: userId });
    return { mode, userId };
  }

  // anonymize: revoke sessions + scrub identifiers + mark anonymised, atomically.
  await prisma.$transaction([
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: anonymizedUserPatch(userId) }),
  ]);
  await audit({ actorId, action: "rgpd.erase.anonymize", ip, targetType: "user", targetId: userId });
  return { mode, userId };
}
