/**
 * organizations.service.ts — tenants + memberships.
 */
import { Prisma, type OrgRole } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { Principal } from "../../lib/auth.js";
import { hashPassword } from "../../lib/auth/password.js";
import { seatAvailable, remainingSeats } from "../../domain/org/seats.js";
import { enroll } from "../enrollments/enrollments.service.js";
import { CourseContent } from "../../domain/content-model.js";
import { computeProgress } from "../../domain/engine/progress.js";

export class OrgError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

export async function createOrganization(name: string, slug: string, creatorId: string) {
  try {
    return await prisma.organization.create({
      data: { name, slug, memberships: { create: { userId: creatorId, orgRole: "OWNER" } } },
      include: { _count: { select: { memberships: true } } },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new OrgError(409, "slug_taken", "Slug d'organisation déjà pris");
    throw e;
  }
}

export async function listOrganizations(principal: Principal) {
  if (principal.role === "SUPER_ADMIN") {
    return prisma.organization.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { memberships: true, courses: true } } } });
  }
  return prisma.organization.findMany({
    where: { memberships: { some: { userId: principal.id } } },
    orderBy: { createdAt: "desc" }, include: { _count: { select: { memberships: true, courses: true } } },
  });
}

export async function getOrganization(id: string) {
  const org = await prisma.organization.findUnique({ where: { id }, include: { _count: { select: { memberships: true, courses: true } } } });
  if (!org) throw new OrgError(404, "not_found", "Organisation introuvable");
  return org;
}

/** True when this membership is the organization's LAST owner — protected. */
async function isLastOwner(organizationId: string, userId: string): Promise<boolean> {
  const m = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  if (!m || m.orgRole !== "OWNER") return false;
  const owners = await prisma.organizationMembership.count({ where: { organizationId, orgRole: "OWNER" } });
  return owners <= 1;
}

export async function addMember(organizationId: string, userId: string, orgRole: OrgRole) {
  await getOrganization(organizationId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new OrgError(404, "no_user", "Utilisateur introuvable");
  if (orgRole !== "OWNER" && (await isLastOwner(organizationId, userId))) {
    throw new OrgError(400, "last_owner", "Impossible : cette personne est le dernier propriétaire de l'organisation");
  }
  return prisma.organizationMembership.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: { orgRole },
    create: { organizationId, userId, orgRole },
  });
}

/** Same as addMember, but resolved from an e-mail (the portal's team form). */
export async function addMemberByEmail(organizationId: string, email: string, orgRole: OrgRole) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new OrgError(404, "no_user", "Aucun compte avec cet e-mail — créez d'abord le compte (ou vérifiez l'adresse)");
  return { membership: await addMember(organizationId, user.id, orgRole), user: { id: user.id, name: user.name, email: user.email } };
}

export async function removeMember(organizationId: string, userId: string) {
  if (await isLastOwner(organizationId, userId)) {
    throw new OrgError(400, "last_owner", "Impossible : il doit rester au moins un propriétaire de l'organisation");
  }
  await prisma.organizationMembership.deleteMany({ where: { organizationId, userId } });
  return { ok: true };
}

export async function listMembers(organizationId: string) {
  await getOrganization(organizationId);
  return prisma.organizationMembership.findMany({
    where: { organizationId }, orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true, role: true, disabledAt: true } } },
  });
}

// --- B2B licensing (seats) --------------------------------------------------

/** A consumed seat = one ACTIVE (non-disabled) MEMBER membership. Org admins and
 *  disabled accounts are free, so deactivating a learner frees its seat. */
async function countSeatsUsed(organizationId: string, tx: Prisma.TransactionClient = prisma) {
  return tx.organizationMembership.count({ where: { organizationId, orgRole: "MEMBER", user: { disabledAt: null } } });
}

export async function seatUsage(organizationId: string) {
  const org = await getOrganization(organizationId);
  const used = await countSeatsUsed(organizationId);
  return { seats: org.seats, used, available: remainingSeats(org.seats, used) };
}

/** Set the licensed seat count — PLATFORM-only (an org admin must not raise it). */
export async function setSeats(organizationId: string, seats: number) {
  await getOrganization(organizationId);
  await prisma.organization.update({ where: { id: organizationId }, data: { seats } });
  return seatUsage(organizationId);
}

/**
 * Create a LEARNER in this org (enterprise self-service), consuming a seat.
 * Quota is re-checked inside the transaction to avoid a race past the limit.
 */
export async function createOrgLearner(organizationId: string, input: { name: string; email: string; password?: string; phone?: string }) {
  await getOrganization(organizationId);
  const passwordHash = input.password ? await hashPassword(input.password) : null; // hash outside the tx
  try {
    return await prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { seats: true } });
      const used = await countSeatsUsed(organizationId, tx);
      if (!seatAvailable(org.seats, used)) {
        throw new OrgError(403, "quota_exceeded", `Licences épuisées (${used}/${org.seats}). Contactez DECLICK pour augmenter le nombre de sièges.`);
      }
      return tx.user.create({
        data: {
          email: input.email, name: input.name, role: "LEARNER", passwordHash, phone: input.phone ?? null,
          emailVerifiedAt: new Date(), // org-provisioned → trusted/verified
          orgMemberships: { create: { organizationId, orgRole: "MEMBER" } },
        },
        select: { id: true, email: true, name: true, role: true, phone: true, createdAt: true },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new OrgError(409, "email_taken", "Un utilisateur avec cet email existe déjà");
    throw e;
  }
}

/**
 * Deactivate / reactivate an org learner. Disabling frees the seat and blocks
 * login (revokes refresh tokens immediately). Reactivating re-checks the quota
 * inside a transaction (a freed seat may have been reused meanwhile).
 */
export async function setLearnerDisabled(organizationId: string, userId: string, disabled: boolean) {
  const m = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  if (!m) throw new OrgError(404, "not_member", "Apprenant introuvable dans cette organisation");
  if (m.orgRole !== "MEMBER") throw new OrgError(400, "not_learner", "Ce compte n'est pas un apprenant de l'organisation");

  if (disabled) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { disabledAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { userId, disabled: true };
  }
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { seats: true } });
    const used = await countSeatsUsed(organizationId, tx);
    if (!seatAvailable(org.seats, used)) {
      throw new OrgError(403, "quota_exceeded", `Licences épuisées (${used}/${org.seats}). Impossible de réactiver ce compte.`);
    }
    await tx.user.update({ where: { id: userId }, data: { disabledAt: null } });
    return { userId, disabled: false };
  });
}

/** Enrol an org learner into a course (org-scoped: member + org/platform course). */
export async function enrollOrgLearner(organizationId: string, userId: string, courseId: string) {
  const m = await prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  if (!m) throw new OrgError(404, "not_member", "Apprenant introuvable dans cette organisation");
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, organizationId: true } });
  if (!course) throw new OrgError(404, "no_course", "Parcours introuvable");
  if (course.organizationId && course.organizationId !== organizationId) {
    throw new OrgError(403, "course_forbidden", "Parcours non disponible pour cette organisation");
  }
  return enroll(userId, courseId, true); // isEnterprise = true
}

// --- learner progress across the organization (ENT lot) ----------------------

/**
 * Progress of every MEMBER of the organization, across ALL their enrolments —
 * independent of who owns the course (shared-catalog courses included). This
 * is the B2B client's core question: "where are my people?".
 */
export async function orgProgress(organizationId: string) {
  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId, orgRole: "MEMBER" },
    include: { user: { select: { id: true, name: true, email: true, disabledAt: true } } },
  });
  const userIds = memberships.map((m) => m.userId);
  if (userIds.length === 0) return [];
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: { in: userIds } },
    include: { courseVersion: true, completions: true },
  });
  const now = Date.now();
  const byUser = new Map<string, { courseTitle: string; progressPercent: number; status: string; lastActivity: Date | null; startedAt: Date }[]>();
  for (const e of enrollments) {
    let progressPercent = 0;
    try {
      const content = CourseContent.parse(e.courseVersion.content);
      const progress = computeProgress(
        content,
        e.completions.map((c) => ({ blockIndex: c.blockIndex, itemKey: c.itemKey, scorePct: c.scorePct })),
        Boolean(e.momentAncrage),
      );
      progressPercent = Math.round((progress.completedBlockIndexes.length / content.blocks.length) * 100);
    } catch { /* unparseable legacy content → 0% rather than a 500 */ }
    const row = {
      courseTitle: (e.courseVersion as { title: string }).title,
      progressPercent,
      status: e.status,
      lastActivity: e.lastSeenAt,
      startedAt: e.startedAt,
    };
    const list = byUser.get(e.userId) ?? [];
    list.push(row);
    byUser.set(e.userId, list);
  }
  return memberships.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    disabled: m.user.disabledAt != null,
    active7d: (byUser.get(m.userId) ?? []).some((r) => r.lastActivity && now - r.lastActivity.getTime() <= 7 * 86_400_000),
    enrollments: byUser.get(m.userId) ?? [],
  }));
}

// --- bulk learner import (ENT lot 2) -----------------------------------------

export type OrgImportReport = {
  total: number;
  created: number;
  enrolled: number;
  invited: number;
  errors: { line: number; email: string; error: string }[];
  credentials: { email: string; password: string }[];
};

/**
 * Bulk import of learners into the organization (portal CSV upload).
 * Seat-aware: refused up-front when the valid rows exceed the remaining seats
 * (no half-imported batch); each row is still quota-re-checked in its own
 * transaction. Existing e-mails are reported as errors (an org cannot absorb
 * an account it does not own). Row-independent otherwise.
 */
export async function importOrgLearners(
  organizationId: string,
  rows: { name?: string; email?: string }[],
  opts: { courseId?: string; invite?: boolean } = {},
): Promise<OrgImportReport> {
  const { generateTempPassword } = await import("../users/users.service.js");
  const { invitationMessage } = await import("../../lib/notify/templates.js");
  const { sendMultichannel } = await import("../../lib/notify/send.js");
  const org = await getOrganization(organizationId);

  const report: OrgImportReport = { total: rows.length, created: 0, enrolled: 0, invited: 0, errors: [], credentials: [] };
  const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid: { line: number; name: string; email: string }[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 1;
    const email = r.email?.trim().toLowerCase() ?? "";
    const name = r.name?.trim() ?? "";
    if (!EMAIL_RX.test(email)) { report.errors.push({ line, email, error: "E-mail invalide" }); return; }
    if (!name) { report.errors.push({ line, email, error: "Nom manquant" }); return; }
    if (seen.has(email)) { report.errors.push({ line, email, error: "Doublon dans le fichier" }); return; }
    seen.add(email);
    valid.push({ line, name, email });
  });

  // Fail fast on the quota: no half-imported batch.
  const used = await countSeatsUsed(organizationId);
  const available = remainingSeats(org.seats ?? 0, used);
  if (valid.length > available) {
    throw new OrgError(403, "quota_exceeded", `Licences insuffisantes : ${valid.length} apprenant(s) à créer pour ${available} siège(s) disponible(s) (${used}/${org.seats ?? 0} utilisés).`);
  }

  for (const row of valid) {
    try {
      const password = generateTempPassword();
      const user = await createOrgLearner(organizationId, { name: row.name, email: row.email, password });
      report.created++;
      report.credentials.push({ email: row.email, password });
      if (opts.courseId) {
        try { await enrollOrgLearner(organizationId, user.id, opts.courseId); report.enrolled++; }
        catch (e) { report.errors.push({ line: row.line, email: row.email, error: `Compte créé mais inscription échouée : ${e instanceof Error ? e.message : "erreur"}` }); }
      }
      if (opts.invite) {
        try {
          const msg = invitationMessage({ name: row.name, orgName: org.name, email: row.email, tempPassword: password });
          const results = await sendMultichannel({ email: row.email, phone: null, subject: msg.subject, body: msg.body, mobileBody: msg.mobileBody });
          if (results.some((r) => r.ok && r.provider !== "console")) report.invited++;
        } catch { /* delivery best-effort */ }
      }
    } catch (e) {
      report.errors.push({ line: row.line, email: row.email, error: e instanceof OrgError ? e.message : e instanceof Error ? e.message : "Erreur" });
    }
  }
  return report;
}
