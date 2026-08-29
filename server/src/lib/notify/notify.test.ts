import { test } from "node:test";
import assert from "node:assert/strict";
import { invitationMessage, otpMessage, reengagementMessage } from "./templates.js";
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

test("reengagementMessage : salutation, nudge, lien direct et signature (P2)", () => {
  const m = reengagementMessage({ stage: "J3", learnerName: "Awa", nudge: "Vous en étiez à « MS 1.2 ».", link: "https://app.declick.digital" });
  assert.match(m.subject, /Awa/);
  assert.doesNotMatch(m.subject, /J3|J7|J14/, "le jargon interne d'étape ne fuit pas vers l'apprenant");
  assert.match(m.body, /^Bonjour Awa,/);
  assert.match(m.body, /MS 1\.2/);
  assert.match(m.body, /Reprendre ma formation : https:\/\/app\.declick\.digital/);
  assert.match(m.body, /L'équipe /);
  assert.match(m.mobileBody, /https:\/\/app\.declick\.digital/);
});

test("reengagementMessage : variante admin (J14 entreprise) sans lien apprenant", () => {
  const m = reengagementMessage({ stage: "J14", learnerName: "Awa", nudge: "Awa est inactif depuis 14 jours.", admin: true, link: "https://app.declick.digital" });
  assert.match(m.subject, /inactif depuis 14 jours/);
  assert.match(m.body, /Awa est inactif/);
  assert.doesNotMatch(m.body, /Reprendre ma formation/);
});

test("reengagementMessage : sans APP_BASE_URL, pas de ligne de lien vide", () => {
  const m = reengagementMessage({ stage: "J7", learnerName: "Awa", nudge: "Reprenez.", link: "" });
  assert.doesNotMatch(m.body, /Reprendre ma formation/);
  assert.match(m.body, /^Bonjour Awa,/);
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
