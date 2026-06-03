/**
 * organizations.service.ts — tenants + memberships.
 */
import { Prisma, type OrgRole } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { Principal } from "../../lib/auth.js";

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
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
}
