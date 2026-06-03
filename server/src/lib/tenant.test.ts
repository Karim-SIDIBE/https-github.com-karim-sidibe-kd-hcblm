import { test } from "node:test";
import assert from "node:assert/strict";
import { isOrgAdmin } from "./tenant.js";

test("isOrgAdmin: OWNER/ADMIN are admins, MEMBER and null are not", () => {
  assert.equal(isOrgAdmin({ organizationId: "o", orgRole: "OWNER" }), true);
  assert.equal(isOrgAdmin({ organizationId: "o", orgRole: "ADMIN" }), true);
  assert.equal(isOrgAdmin({ organizationId: "o", orgRole: "MEMBER" }), false);
  assert.equal(isOrgAdmin(null), false);
});
