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
