import { test } from "node:test";
import assert from "node:assert/strict";
import { toScim, serviceProviderConfig } from "./scim.service.js";

test("toScim emits a valid SCIM 2.0 User resource", () => {
  const r = toScim({ id: "u_1", email: "awa@acme.africa", name: "Awa Diop" }, "okta-123", true);
  assert.deepEqual(r.schemas, ["urn:ietf:params:scim:schemas:core:2.0:User"]);
  assert.equal(r.id, "u_1");
  assert.equal(r.userName, "awa@acme.africa");
  assert.equal(r.externalId, "okta-123");
  assert.equal(r.emails[0]!.value, "awa@acme.africa");
  assert.equal(r.active, true);
  assert.equal(r.meta.resourceType, "User");
  assert.match(r.meta.location, /\/scim\/v2\/Users\/u_1$/);
});

test("toScim omits externalId when absent and reflects inactive", () => {
  const r = toScim({ id: "u_2", email: "x@y.z", name: "X" }, null, false);
  assert.equal("externalId" in r, false);
  assert.equal(r.active, false);
});

test("ServiceProviderConfig advertises patch + filter + bearer auth", () => {
  const c = serviceProviderConfig();
  assert.equal(c.patch.supported, true);
  assert.equal(c.filter.supported, true);
  assert.equal(c.authenticationSchemes[0]!.type, "oauthbearertoken");
});
