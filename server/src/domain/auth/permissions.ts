/**
 * permissions.ts — role-based access control matrix (pure).
 *
 * Capability-based: routes require a permission; each role grants a set of them.
 * Keeps authorization declarative and testable, independent of the transport.
 */
import type { Role } from "@prisma/client";

export type Permission =
  // authoring lifecycle
  | "course:create"
  | "course:read" // read drafts / non-published (published courses are public-ish)
  | "course:update" // edit a DRAFT
  | "course:submit_review" // DRAFT → IN_REVIEW
  | "course:review" // approve / request changes on IN_REVIEW
  | "course:publish" // → PUBLISHED (runs the gate)
  | "course:archive" // → ARCHIVED
  // runtime / ops
  | "enrollment:create" // enrol someone (self handled by ownership)
  | "enrollment:read_any" // read any enrolment (staff)
  | "evaluation:grade" // Bloc 4 rubric scoring
  | "user:manage" // create / manage users
  | "job:run" // trigger scheduled jobs
  | "analytics:read" // dashboards / reports
  | "audit:read" // security audit trail
  | "session:manage" // create / host live sessions, mark attendance
  | "forum:moderate" // manage cohorts/memberships, moderate forum threads/posts
  | "media:manage" // upload / manage media assets
  | "credential:revoke" // revoke issued verifiable credentials
  | "lti:manage" // register / manage LTI platforms
  | "org:manage"; // create / oversee organizations (platform level)

const ALL: Permission[] = [
  "course:create", "course:read", "course:update", "course:submit_review",
  "course:review", "course:publish", "course:archive",
  "enrollment:create", "enrollment:read_any", "evaluation:grade",
  "user:manage", "job:run", "analytics:read", "audit:read", "session:manage", "forum:moderate", "media:manage", "credential:revoke", "lti:manage", "org:manage",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  COURSE_ADMIN: [
    "course:create", "course:read", "course:update", "course:submit_review",
    "course:review", "course:publish", "course:archive",
    "enrollment:create", "enrollment:read_any", "user:manage", "job:run", "analytics:read", "audit:read", "session:manage", "forum:moderate", "media:manage", "credential:revoke", "lti:manage", "org:manage",
  ],
  LEARNING_DESIGNER: ["course:create", "course:read", "course:update", "course:submit_review", "media:manage"],
  REVIEWER: ["course:read", "course:review", "course:publish"],
  INSTRUCTOR: ["course:read", "enrollment:create", "enrollment:read_any", "analytics:read", "session:manage", "forum:moderate"],
  EVALUATOR: ["course:read", "evaluation:grade", "enrollment:read_any", "analytics:read"],
  ENTERPRISE_CLIENT: ["course:read", "enrollment:read_any", "analytics:read"],
  EMPLOYER: ["course:read", "analytics:read"],
  LEARNER: ["enrollment:create"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Roles considered staff for ownership checks (can act on others' enrolments). */
export const STAFF_ROLES: Role[] = ["SUPER_ADMIN", "COURSE_ADMIN", "INSTRUCTOR", "EVALUATOR"];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}
