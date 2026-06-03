/**
 * tenant.ts — multi-tenant context resolution.
 *
 * The active organization for a request comes from the `x-org-id` header,
 * validated against the principal's membership. SUPER_ADMIN may act in any org
 * (cross-tenant). No header → platform context (shared catalogue only).
 */
import { prisma } from "../db/prisma.js";
import type { Principal } from "./auth.js";

export type TenantContext = { organizationId: string; orgRole: string } | null;

export async function resolveTenant(principal: Principal, xOrgId: unknown): Promise<TenantContext> {
  if (typeof xOrgId !== "string" || !xOrgId) return null;
  if (principal.role === "SUPER_ADMIN") {
    const org = await prisma.organization.findUnique({ where: { id: xOrgId } });
    return org ? { organizationId: org.id, orgRole: "OWNER" } : null;
  }
  const m = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: xOrgId, userId: principal.id } },
  });
  return m ? { organizationId: m.organizationId, orgRole: m.orgRole } : null;
}

/** Org ids the principal can see content for (their memberships). */
export async function memberOrgIds(principal: Principal): Promise<string[]> {
  const ms = await prisma.organizationMembership.findMany({ where: { userId: principal.id }, select: { organizationId: true } });
  return ms.map((m) => m.organizationId);
}

export const isOrgAdmin = (ctx: TenantContext) => ctx != null && (ctx.orgRole === "OWNER" || ctx.orgRole === "ADMIN");
