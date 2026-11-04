import { test } from "node:test";
import assert from "node:assert/strict";
import { createSas, maskOnce } from "./pseudo.js";

test("masque courriels, téléphones, URLs et longs numéros", () => {
  const sas = createSas();
  const masked = sas.mask(
    "Contactez aya.kone@exemple-demo.ci ou au +225 07 08 09 10 11, " +
    "dossier https://app.declick.digital/#/suivi/123, compte 1234567890123.",
  );
  assert.doesNotMatch(masked, /aya\.kone@/);
  assert.doesNotMatch(masked, /\+225/);
  assert.doesNotMatch(masked, /app\.declick\.digital/);
  assert.doesNotMatch(masked, /1234567890123/);
  assert.match(masked, /\[\[courriel-1\]\]/);
  assert.match(masked, /\[\[numero-1\]\]/);
  assert.match(masked, /\[\[lien-1\]\]/);
  assert.equal(sas.count(), 4);
});

test("ne touche ni dates, ni montants, ni années, ni identifiants cuid", () => {
  const sas = createSas();
  const text = "Le 14/10/2026, Aya a réglé 50 000 F CFA (réf. cmvf61ymx000yq27dmsz4pp5f) — objectif 2027, score 85/100.";
  assert.equal(sas.mask(text), text);
  assert.equal(sas.count(), 0);
});

test("jetons stables : la même valeur reçoit le même jeton", () => {
  const sas = createSas();
  const a = sas.mask("Écrire à franck@labsinfo-ci.com.");
  const b = sas.mask("Rappel : franck@labsinfo-ci.com attend.");
  const token = a.match(/\[\[courriel-\d+\]\]/)![0];
  assert.ok(b.includes(token));
  assert.equal(sas.count(), 1);
});

test("identifiants connus (nom) : masqués partout, le plus long d'abord, et restitués", () => {
  const sas = createSas(["Aya Koné", "Aya"]);
  const masked = sas.mask("Bonjour Aya Koné ! Aya, votre parcours vous attend.");
  assert.doesNotMatch(masked, /Aya/);
  const answer = `Courage ${masked.match(/\[\[nom-\d+\]\]/)![0]}, reprenez 15 minutes.`;
  assert.match(sas.reinject(answer), /Courage Aya Koné, reprenez/);
});

test("restitution : aller-retour complet sur un texte mêlé", () => {
  const sas = createSas(["Franck Kouassi"]);
  const original = "Franck Kouassi (franck@labsinfo-ci.com, +225 01 02 03 04 05) a visité https://declick.digital.";
  const masked = sas.mask(original);
  assert.equal(sas.reinject(masked), original);
});

test("maskOnce : masquage sans restitution (embeddings)", () => {
  const out = maskOnce("question de test envoyée depuis test@exemple.ci");
  assert.doesNotMatch(out, /test@exemple\.ci/);
  assert.match(out, /\[\[courriel-1\]\]/);
});
