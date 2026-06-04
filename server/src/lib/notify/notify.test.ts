import { test } from "node:test";
import assert from "node:assert/strict";
import { invitationMessage, otpMessage } from "./templates.js";
import { sendEmail, sendMultichannel } from "./send.js";

test("invitationMessage includes identity, org and access info", () => {
  const m = invitationMessage({ name: "Aminata", orgName: "Acme", email: "a@acme.com", tempPassword: "Secret12!" });
  assert.match(m.subject, /Acme/);
  assert.match(m.body, /Aminata/);
  assert.match(m.body, /a@acme\.com/);
  assert.match(m.body, /Secret12!/);
  assert.ok(m.mobileBody.length < m.body.length, "mobile body is the short variant");
});

test("invitationMessage without a temp password points to password reset", () => {
  const m = invitationMessage({ name: "Kouamé", orgName: "Acme", email: "k@acme.com" });
  assert.match(m.body, /Mot de passe oubli/i);
  assert.doesNotMatch(m.body, /provisoire/i);
});

test("otpMessage carries the code and an expiry", () => {
  const m = otpMessage("482190", 10);
  assert.match(m.body, /482190/);
  assert.match(m.body, /10 minutes/);
  assert.match(m.mobileBody, /482190/);
});

test("send falls back to console when nothing is configured (ok)", async () => {
  const r = await sendEmail("x@example.com", "Hi", "Body");
  assert.equal(r.ok, true);
  assert.equal(r.provider, "console");
});

test("sendMultichannel attempts each provided channel", async () => {
  const results = await sendMultichannel({ email: "x@example.com", phone: "+2250700000000", subject: "S", body: "B" });
  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.ok));
});
