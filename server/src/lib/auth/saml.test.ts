import { test } from "node:test";
import assert from "node:assert/strict";
import { extractIdentity } from "./saml.js";

test("extracts email from the email attribute", () => {
  const id = extractIdentity({ email: "awa@corp.africa", displayName: "Awa Sow", nameID: "S-1-5-21" });
  assert.equal(id.email, "awa@corp.africa");
  assert.equal(id.name, "Awa Sow");
});

test("falls back to an email-shaped NameID", () => {
  const id = extractIdentity({ nameID: "koffi@corp.africa" });
  assert.equal(id.email, "koffi@corp.africa");
});

test("reads the WS-* email/name claims (ADFS / Entra style)", () => {
  const id = extractIdentity({
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "bintou@corp.africa",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "Bintou Diallo",
  });
  assert.equal(id.email, "bintou@corp.africa");
  assert.equal(id.name, "Bintou Diallo");
});

test("returns null email when no email is present", () => {
  assert.equal(extractIdentity({ nameID: "opaque-id-123" }).email, null);
});
