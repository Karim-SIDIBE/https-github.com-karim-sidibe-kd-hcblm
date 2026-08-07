import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCredentialPage, renderNotFoundPage, type CredentialPageData } from "./page.js";

const base: CredentialPageData = {
  id: "cred123",
  brand: { name: "DECLICK DIGITAL", operator: "KOMPETENCES DECLICK", logoDataUri: "data:image/png;base64,AAAA" },
  issuerName: "KOMPETENCES SOFT SKILLS",
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
  assert.match(html, /émis par KOMPETENCES SOFT SKILLS/); // issuer ≠ platform
  assert.doesNotMatch(html, /émis par DECLICK/);
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

test("header mirrors the PWA appbar: logo + two-tone wordmark + operator", () => {
  const html = renderCredentialPage(base);
  assert.match(html, /<img src="data:image\/png;base64,AAAA"/);
  assert.match(html, /DECLICK <span style="color:#2DAA4F">DIGITAL<\/span>/);
  assert.match(html, /Opéré par KOMPETENCES DECLICK/);
});

test("missing logo falls back to the text wordmark", () => {
  const html = renderCredentialPage({ ...base, brand: { ...base.brand, logoDataUri: null } });
  assert.doesNotMatch(html, /<img /);
  assert.match(html, /DECLICK <span/);
});

test("not-found page is standalone French HTML with the brand header", () => {
  const html = renderNotFoundPage(base.brand);
  assert.match(html, /Certificat introuvable/);
  assert.match(html, /lang="fr"/);
  assert.match(html, /Opéré par KOMPETENCES DECLICK/);
});
