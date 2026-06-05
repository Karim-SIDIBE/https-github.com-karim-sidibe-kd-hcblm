/**
 * users.service.ts — user-management helpers shared by the routes.
 */
import { randomInt } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { hashPassword } from "../../lib/auth/password.js";
import { sendMultichannel } from "../../lib/notify/send.js";
import { invitationMessage } from "../../lib/notify/templates.js";

export class UserError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

/** All accounts (for the admin support screen), with status + enrolment count. */
export async function listUsers(q?: string) {
  const term = q?.trim();
  const where = term
    ? { OR: [{ email: { contains: term, mode: "insensitive" as const } }, { name: { contains: term, mode: "insensitive" as const } }] }
    : {};
  const now = new Date();
  const users = await prisma.user.findMany({
    where, orderBy: { createdAt: "desc" }, take: 500,
    select: { id: true, name: true, email: true, role: true, emailVerifiedAt: true, disabledAt: true, lockedUntil: true, createdAt: true, _count: { select: { enrollments: true } } },
  });
  return users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    verified: u.emailVerifiedAt != null, disabled: u.disabledAt != null,
    locked: u.lockedUntil != null && u.lockedUntil > now,
    enrollments: u._count.enrollments, createdAt: u.createdAt,
  }));
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
