/**
 * users.service.ts — user-management helpers shared by the routes.
 */
import { randomInt } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { hashPassword } from "../../lib/auth/password.js";
import type { SortSpec } from "../../lib/paging.js";
import { daysUntilPurge } from "../../domain/rgpd.js";
import { sendMultichannel } from "../../lib/notify/send.js";
import { invitationMessage } from "../../lib/notify/templates.js";

export class UserError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

export const USER_SORTS = ["name", "email", "role", "createdAt"] as const;

/** All accounts (for the admin support screen), with status + enrolment count.
 *  Paged + sorted server-side so the screen scales past a few hundred users. */
export async function listUsers(opts: { q?: string; page?: number; pageSize?: number; sort?: SortSpec } = {}) {
  const term = opts.q?.trim();
  const where = term
    ? { OR: [{ email: { contains: term, mode: "insensitive" as const } }, { name: { contains: term, mode: "insensitive" as const } }] }
    : {};
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 500;
  const sort = opts.sort ?? { field: "createdAt", dir: "desc" as const };
  const now = new Date();
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: { [sort.field]: sort.dir }, skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, name: true, email: true, role: true, emailVerifiedAt: true, disabledAt: true, lockedUntil: true, anonymizedAt: true, deletionRequestedAt: true, createdAt: true, _count: { select: { enrollments: true } } },
    }),
  ]);
  const rows = users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    verified: u.emailVerifiedAt != null, disabled: u.disabledAt != null,
    locked: u.lockedUntil != null && u.lockedUntil > now,
    anonymized: u.anonymizedAt != null,
    // Scheduled erasure (Art. 17): whole days left to restore before the purge.
    deletionDaysLeft: u.deletionRequestedAt ? daysUntilPurge(u.deletionRequestedAt, now, env.RGPD_GRACE_DAYS) : null,
    enrollments: u._count.enrollments, createdAt: u.createdAt,
  }));
  return { rows, total };
}

/**
 * Edit an account (staff): identity, role, activation, password reset.
 * Guard-rails: you cannot change your own role or disable yourself, and the
 * platform always keeps at least one active SUPER_ADMIN.
 */
export async function updateUser(
  actorId: string | undefined,
  userId: string,
  patch: { name?: string; email?: string; role?: string; disabled?: boolean; password?: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, disabledAt: true } });
  if (!user) throw new UserError(404, "not_found", "Utilisateur introuvable");
  if (actorId === userId) {
    if (patch.role !== undefined && patch.role !== user.role) throw new UserError(400, "self_role", "Vous ne pouvez pas changer votre propre rôle");
    if (patch.disabled === true) throw new UserError(400, "self_disable", "Vous ne pouvez pas désactiver votre propre compte");
  }
  const losesSuperAdmin =
    user.role === "SUPER_ADMIN" &&
    ((patch.role !== undefined && patch.role !== "SUPER_ADMIN") || patch.disabled === true);
  if (losesSuperAdmin) {
    const others = await prisma.user.count({ where: { role: "SUPER_ADMIN", disabledAt: null, id: { not: userId } } });
    if (others === 0) throw new UserError(400, "last_super_admin", "Impossible : il doit rester au moins un super-administrateur actif");
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.role !== undefined ? { role: patch.role as never } : {}),
      ...(patch.disabled !== undefined ? { disabledAt: patch.disabled ? (user.disabledAt ?? new Date()) : null } : {}),
      ...(patch.password !== undefined ? { passwordHash: await hashPassword(patch.password), failedLoginCount: 0, lockedUntil: null } : {}),
    },
    select: { id: true, name: true, email: true, role: true, disabledAt: true },
  });
  return { id: updated.id, name: updated.name, email: updated.email, role: updated.role, disabled: updated.disabledAt != null };
}

const SETS = { A: "ABCDEFGHJKLMNPQRSTUVWXYZ", a: "abcdefghijkmnpqrstuvwxyz", n: "23456789", s: "!@#$%&*" };

/** A 12-char temp password with at least one of each class (crypto-random). */
export function generateTempPassword(): string {
  const all = SETS.A + SETS.a + SETS.n + SETS.s;
  const pick = (set: string) => set[randomInt(set.length)]!;
  const chars = [pick(SETS.A), pick(SETS.a), pick(SETS.n), pick(SETS.s)];
  for (let i = 0; i < 8; i++) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join("");
}

/**
 * (Re)send an access invitation to a learner. Sets a fresh temporary password
 * (or the one provided), unlocks the account, and delivers the invitation by
 * e-mail (+ WhatsApp when a phone is on file). Returns the temp password so the
 * admin can also read it out, and the per-channel delivery outcome.
 */
export async function inviteUser(userId: string, password?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { orgMemberships: { include: { organization: { select: { name: true } } }, take: 1 } },
  });
  if (!user) throw new UserError(404, "not_found", "Utilisateur introuvable");

  const temp = password ?? generateTempPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(temp), failedLoginCount: 0, lockedUntil: null },
  });

  const orgName = user.orgMemberships[0]?.organization.name ?? env.BRAND_NAME;
  const msg = invitationMessage({ name: user.name, orgName, email: user.email, tempPassword: temp });
  const results = await sendMultichannel({ email: user.email, phone: user.phone, subject: msg.subject, body: msg.body, mobileBody: msg.mobileBody });

  return {
    tempPassword: temp,
    // "delivered" only when a REAL channel succeeded — the console fallback
    // (no SMTP/webhook configured) does not count as delivered.
    delivered: results.some((r) => r.ok && r.provider !== "console"),
    channels: results.map((r) => ({ provider: r.provider, ok: r.ok })),
  };
}

/**
 * Hard-delete a user. All User relations cascade (enrolments + their progress,
 * tokens, memberships…) or set null (authored content is preserved), and the
 * audit log keeps actorId as plain text, so history survives. Self-deletion is
 * refused.
 */
export async function deleteUser(actorId: string | undefined, userId: string) {
  if (actorId && actorId === userId) throw new UserError(400, "self_delete", "Vous ne pouvez pas supprimer votre propre compte");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } });
  if (!user) throw new UserError(404, "not_found", "Utilisateur introuvable");
  await prisma.user.delete({ where: { id: userId } });
  return { id: user.id, email: user.email };
}

// --- bulk import (M3) --------------------------------------------------------

export type ImportRow = { name?: string; email?: string; role?: string };
export type ImportReport = {
  total: number;
  created: number;
  existing: number;
  enrolled: number;
  invited: number;
  errors: { line: number; email: string; error: string }[];
  credentials: { email: string; password: string }[];
};

const VALID_ROLES = new Set(["LEARNER", "LEARNING_DESIGNER", "REVIEWER", "INSTRUCTOR", "EVALUATOR", "COURSE_ADMIN", "SUPER_ADMIN", "ENTERPRISE_CLIENT", "EMPLOYER"]);
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bulk user import (CSV upload in the admin). Row-independent: one bad line
 * never blocks the rest. Existing accounts are not modified but still get
 * enrolled/invited when requested. Created accounts receive a strong temp
 * password, returned in the report unless the invitation e-mail delivers it.
 */
export async function importUsers(
  rows: ImportRow[],
  opts: { courseId?: string; invite?: boolean } = {},
): Promise<ImportReport> {
  const report: ImportReport = { total: rows.length, created: 0, existing: 0, enrolled: 0, invited: 0, errors: [], credentials: [] };
  if (opts.courseId) {
    const course = await prisma.course.findUnique({ where: { id: opts.courseId } });
    if (!course) throw new UserError(404, "no_course", "Parcours introuvable");
  }
  for (let i = 0; i < rows.length; i++) {
    const line = i + 1;
    const row = rows[i] ?? {};
    const email = row.email?.trim().toLowerCase() ?? "";
    const name = row.name?.trim() ?? "";
    const role = (row.role?.trim().toUpperCase() || "LEARNER");
    if (!EMAIL_RX.test(email)) { report.errors.push({ line, email, error: "E-mail invalide" }); continue; }
    if (!name) { report.errors.push({ line, email, error: "Nom manquant" }); continue; }
    if (!VALID_ROLES.has(role)) { report.errors.push({ line, email, error: `Rôle inconnu : ${role}` }); continue; }
    try {
      let user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        report.existing++;
      } else {
        const password = generateTempPassword();
        user = await prisma.user.create({
          data: { email, name, role: role as never, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
        });
        report.created++;
        report.credentials.push({ email, password });
      }
      if (opts.courseId) {
        // Reuse the engine's enrolment (publishes the xAPI "initialized" trace).
        const already = await prisma.enrollment.findFirst({ where: { userId: user.id, courseId: opts.courseId } });
        if (!already) {
          const { enroll } = await import("../enrollments/enrollments.service.js");
          await enroll(user.id, opts.courseId);
          report.enrolled++;
        }
      }
      if (opts.invite) {
        try { const r = await inviteUser(user.id); if (r.delivered) report.invited++; }
        catch { /* invitation failure must not fail the row */ }
      }
    } catch (e) {
      report.errors.push({ line, email, error: e instanceof Error ? e.message : "Erreur" });
    }
  }
  return report;
}
