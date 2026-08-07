import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCredentialPage, renderNotFoundPage, type CredentialPageData } from "./page.js";

const base: CredentialPageData = {
  id: "cred123",
  holderName: "Awa Diallo",
  courseTitle: "Gestion du Temps & Productivité",
  achievementName: "Certificat de Compétences — Niveau 1",
  level: 1,
  issuedOn: new Date("2026-07-07T10:00:00Z"),
  revoked: false,
  revocationReason: null,
  signatureValid: true,
};

test("valid credential renders a green verdict with holder and course", () => {
  const html = renderCredentialPage(base);
  assert.match(html, /Certificat valide/);
  assert.match(html, /Awa Diallo/);
  assert.match(html, /Gestion du Temps &amp; Productivité/);
  assert.match(html, /Niveau 1/);
  assert.match(html, /cred123/);
  assert.match(html, /juillet 2026/);
  assert.match(html, /\?format=json/); // technical links stay reachable
  assert.match(html, /\/api\/v1\/credentials\/cred123\/vc/);
});

test("revoked credential shows the revocation and its reason", () => {
  const html = renderCredentialPage({ ...base, revoked: true, revocationReason: "Erreur d'attribution" });
  assert.match(html, /Certificat révoqué/);
  assert.match(html, /Erreur d&#39;attribution/);
  assert.doesNotMatch(html, /Certificat valide/);
});

test("unverifiable signature warns instead of validating", () => {
  const html = renderCredentialPage({ ...base, signatureValid: false });
  assert.match(html, /Signature non vérifiable/);
  assert.doesNotMatch(html, /Certificat valide/);
});

test("holder-controlled strings are HTML-escaped", () => {
  const html = renderCredentialPage({ ...base, holderName: `<script>alert(1)</script>` });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test("revocation wins over an invalid signature in the verdict", () => {
  const html = renderCredentialPage({ ...base, revoked: true, signatureValid: false });
  assert.match(html, /Certificat révoqué/);
});

test("not-found page is standalone French HTML", () => {
  const html = renderNotFoundPage();
  assert.match(html, /Certificat introuvable/);
  assert.match(html, /lang="fr"/);
});
