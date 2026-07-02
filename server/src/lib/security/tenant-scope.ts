/**
 * tenant-scope.ts — organization scoping for reporting / analytics surfaces.
 *
 * The reporting, analytics and LRS-query modules were built on raw
 * `courseId` / `enrollmentId` / `cohortId` lookups and never wired to the
 * multi-tenant model, so a customer role (`ENTERPRISE_CLIENT`, `ENTERPRISE_ADMIN`,
 * `EMPLOYER` — holders of `analytics:read` that are NOT platform staff) could read
 * another tenant's learner PII (name, e-mail, Moment d'Ancrage) by passing an id
 * from another org. This helper confines those roles to courses their org owns,
 * while platform staff (SUPER_ADMIN / COURSE_ADMIN / INSTRUCTOR / EVALUATOR) keep
 * full reach — the same isolation the `courses` module already enforces.
 *
 * We answer "not found" (404) rather than "forbidden" (403) so a cross-tenant
 * probe cannot even confirm that a given course/enrollment exists.
 */
import type { preHandlerHookHandler } from "fastify";
import { prisma } from "../../db/prisma.js";
import type { Principal } from "../auth.js";
import { isStaff } from "../../domain/auth/permissions.js";
import { memberOrgIds } from "../tenant.js";

export class TenantScopeError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}

/**
 * May this principal see data owned by `organizationId` (null = shared platform
 * catalog)? Platform staff: always. Non-staff: only their own orgs, and never
 * the platform-wide (org-less) dataset — that would expose every B2C learner.
 */
async function canSeeOrg(principal: Principal, organizationId: string | null): Promise<boolean> {
  if (isStaff(principal.role)) return true;
  if (!organizationId) return false;
  return (await memberOrgIds(principal)).includes(organizationId);
}

/** Throw unless the principal may read analytics for `courseId`. */
export async function assertCourseAccess(principal: Principal, courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  if (!course || !(await canSeeOrg(principal, course.organizationId))) {
    throw new TenantScopeError(404, "not_found", "Parcours introuvable");
  }
}

/** Throw unless the principal may read analytics for `enrollmentId`. */
export async function assertEnrollmentAccess(principal: Principal, enrollmentId: string): Promise<void> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { course: { select: { organizationId: true } } },
  });
  if (!enrollment || !(await canSeeOrg(principal, enrollment.course.organizationId))) {
    throw new TenantScopeError(404, "not_found", "Inscription introuvable");
  }
}

/** Throw unless the principal may read analytics for `cohortId`. */
export async function assertCohortAccess(principal: Principal, cohortId: string): Promise<void> {
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: { course: { select: { organizationId: true } } },
  });
  // A cohort may be untied to a course (courseId null) → treat as platform-shared.
  if (!cohort || !(await canSeeOrg(principal, cohort.course?.organizationId ?? null))) {
    throw new TenantScopeError(404, "not_found", "Cohorte introuvable");
  }
}

/** Course ids the principal may read reports for: "all" (staff) or an id list. */
export async function visibleCourseIds(principal: Principal): Promise<"all" | string[]> {
  if (isStaff(principal.role)) return "all";
  const orgs = await memberOrgIds(principal);
  if (orgs.length === 0) return [];
  const courses = await prisma.course.findMany({ where: { organizationId: { in: orgs } }, select: { id: true } });
  return courses.map((c) => c.id);
}

type ScopeKind = "course" | "enrollment" | "cohort";

/**
 * preHandler factory: enforce tenant scope on the `:{param}` route parameter.
 * Runs after `guard(...)`, so `req.principal` is set. Short-circuits with 404 on
 * a cross-tenant access attempt.
 */
export function scopeParam(kind: ScopeKind, param: string): preHandlerHookHandler {
  return async (req, reply) => {
    const id = (req.params as Record<string, string | undefined>)[param];
    if (!id) return reply.status(400).send({ error: "bad_request", message: "identifiant manquant" });
    try {
      if (kind === "course") await assertCourseAccess(req.principal!, id);
      else if (kind === "enrollment") await assertEnrollmentAccess(req.principal!, id);
      else await assertCohortAccess(req.principal!, id);
    } catch (err) {
      if (err instanceof TenantScopeError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
      throw err;
    }
  };
}
