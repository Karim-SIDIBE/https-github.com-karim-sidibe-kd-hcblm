import { test } from "node:test";
import assert from "node:assert/strict";
import { hostedAssertion, verifiableCredential, badgeClassDocument, issuerDocument } from "./openbadge.js";

const achievement = {
  courseSlug: "gestion-du-temps-n1", type: "CERTIFICATE",
  name: "Certificat de Niveau 1", description: "Gestion du temps",
  criteria: ["Projet soumis", "Grille ≥ 70/100"],
  competencies: [{ code: "D4.C1", label: "Organisation personnelle" }],
};

test("issuer + badge class are valid Open Badges JSON-LD", () => {
  assert.equal(issuerDocument().type, "Issuer");
  const bc = badgeClassDocument(achievement);
  assert.equal(bc.type, "BadgeClass");
  assert.equal(bc.issuer, issuerDocument().id);
  assert.equal(bc.alignment[0]!.targetCode, "D4.C1");
});

test("OB 2.0 assertion hashes the recipient and marks hosted verification", () => {
  const a = hostedAssertion({
    credentialId: "cred_1", achievement, recipientHash: "deadbeef", recipientSalt: "s1",
    issuedAt: new Date("2026-06-01T00:00:00Z"), revoked: false,
  });
  assert.equal(a.type, "Assertion");
  assert.equal(a.recipient.hashed, true);
  assert.equal(a.recipient.identity, "sha256$deadbeef");
  assert.equal(a.verification.type, "HostedBadge");
  assert.equal((a as any).revoked, undefined);
});

test("OB 3.0 credential is a typed Verifiable Credential", () => {
  const vc = verifiableCredential({
    credentialId: "cred_1", achievement, recipientHash: "deadbeef", subjectName: "Awa", issuedAt: new Date(),
  });
  assert.ok(vc.type.includes("VerifiableCredential") && vc.type.includes("OpenBadgeCredential"));
  assert.equal(vc.credentialSubject.achievement.name, "Certificat de Niveau 1");
  assert.equal(vc.credentialSubject.identifier.identityHash, "sha256$deadbeef");
});

test("the Bloc 4 rubric result surfaces as OB2 evidence + OB3 results", () => {
  const withResult = { ...achievement, result: { score: 85, max: 100, threshold: 70, passed: true } };
  const a: any = hostedAssertion({ credentialId: "c1", achievement: withResult, recipientHash: "x", recipientSalt: "s", issuedAt: new Date(), revoked: false });
  assert.match(a.narrative, /85\/100/);
  assert.equal(a.evidence[0].type, "Evidence");

  const vc: any = verifiableCredential({ credentialId: "c1", achievement: withResult, recipientHash: "x", subjectName: "Awa", issuedAt: new Date() });
  assert.equal(vc.credentialSubject.results[0].value, "85");
  assert.equal(vc.credentialSubject.results[0].status, "Completed");
  assert.equal(vc.credentialSubject.achievement.resultDescriptions[0].requiredValue, "70");
});

test("A3 : l'assertion OB2 et le VC portent l'échéance quand elle est fournie — jamais sinon", () => {
  const achievement = { courseSlug: "c", type: "CERTIFICATE", name: "n", description: "d", criteria: ["x"] };
  const issuedAt = new Date("2026-09-19T00:00:00Z");
  const expiresAt = new Date("2029-09-19T00:00:00Z");
  const withExp = hostedAssertion({ credentialId: "id1", achievement, recipientHash: "h", recipientSalt: "s", issuedAt, expiresAt, revoked: false }) as any;
  assert.equal(withExp.expires, expiresAt.toISOString());
  const badge = hostedAssertion({ credentialId: "id2", achievement: { ...achievement, type: "ENTRY" }, recipientHash: "h", recipientSalt: "s", issuedAt, revoked: false }) as any;
  assert.equal("expires" in badge, false); // les badges de bloc n'expirent pas
  const vc = verifiableCredential({ credentialId: "id1", achievement, recipientHash: "h", subjectName: "N", issuedAt, expiresAt }) as any;
  assert.equal(vc.expirationDate, expiresAt.toISOString());
});
