/**
 * organizations.service.ts — tenants + memberships.
 */
import { Prisma, type OrgRole } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { Principal } from "../../lib/auth.js";
import { hashPassword } from "../../lib/auth/password.js";
import { seatAvailable, remainingSeats } from "../../domain/org/seats.js";
import { enroll } from "../enrollments/enrollments.service.js";

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

export async function addMember(organizationId: string, userId: string, orgRole: OrgRole) {
  await getOrganization(organizationId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new OrgError(404, "no_user", "Utilisateur introuvable");
  return prisma.organizationMembership.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: { orgRole },
    create: { organizationId, userId, orgRole },
  });
}

export async function removeMember(organizationId: string, userId: string) {
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
export async function createOrgLearner(organizationId: string, input: { name: string; email: string; password?: string }) {
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
          email: input.email, name: input.name, role: "LEARNER", passwordHash,
          orgMemberships: { create: { organizationId, orgRole: "MEMBER" } },
        },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
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
