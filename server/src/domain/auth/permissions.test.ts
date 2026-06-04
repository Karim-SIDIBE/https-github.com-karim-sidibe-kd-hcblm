import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPermission, isStaff } from "./permissions.js";

test("Learning Designer can create but not publish", () => {
  assert.equal(hasPermission("LEARNING_DESIGNER", "course:create"), true);
  assert.equal(hasPermission("LEARNING_DESIGNER", "course:publish"), false);
});

test("Reviewer can review and publish-on-approve, not author", () => {
  assert.equal(hasPermission("REVIEWER", "course:review"), true);
  assert.equal(hasPermission("REVIEWER", "course:publish"), true);
  assert.equal(hasPermission("REVIEWER", "course:create"), false);
});

test("Evaluator grades; only admins read audit", () => {
  assert.equal(hasPermission("EVALUATOR", "evaluation:grade"), true);
  assert.equal(hasPermission("EVALUATOR", "audit:read"), false);
  assert.equal(hasPermission("SUPER_ADMIN", "audit:read"), true);
  assert.equal(hasPermission("COURSE_ADMIN", "audit:read"), true);
});

test("Super Admin has every permission", () => {
  assert.equal(hasPermission("SUPER_ADMIN", "course:create"), true);
  assert.equal(hasPermission("SUPER_ADMIN", "user:manage"), true);
});

test("staff vs non-staff for enrolment ownership", () => {
  assert.equal(isStaff("COURSE_ADMIN"), true);
  assert.equal(isStaff("INSTRUCTOR"), true);
  assert.equal(isStaff("LEARNING_DESIGNER"), false); // content staff, not learner-mgmt staff
  assert.equal(isStaff("LEARNER"), false);
});

test("ENTERPRISE_ADMIN is read-only GLOBALLY (create powers are org-scoped only)", () => {
  // It must NOT be able to manage users or enrol platform-wide via the global
  // matrix — those are granted only through an OWNER/ADMIN org membership.
  assert.equal(hasPermission("ENTERPRISE_ADMIN", "user:manage"), false);
  assert.equal(hasPermission("ENTERPRISE_ADMIN", "enrollment:create"), false);
  assert.equal(hasPermission("ENTERPRISE_ADMIN", "org:manage"), false);
  // Read-only reporting is allowed.
  assert.equal(hasPermission("ENTERPRISE_ADMIN", "analytics:read"), true);
  assert.equal(hasPermission("ENTERPRISE_ADMIN", "course:read"), true);
  // Not learner-management staff (can't act cross-tenant via ownership bypass).
  assert.equal(isStaff("ENTERPRISE_ADMIN"), false);
});
