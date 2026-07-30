import { test } from "node:test";
import assert from "node:assert/strict";
import { assessText, fieldExpectsNumber, hasNumber, isImplausibleWord } from "./textcheck.js";

test("blocks keyboard-mash and vowel-less pseudo-words", () => {
  // The exact garbage observed in the field tests must be caught.
  const a = assessText("ihfhd bklblabl hiofhpohf hpfhprhg nh. nsdihoihf bebhefiyzef khopyh.");
  assert.equal(a.ok, false);
  if (!a.ok && a.code === "gibberish") assert.ok(a.words.length >= 2);
  assert.equal(assessText("azerty qsdfgh wxcvbn").ok, false);
});

test("accepts real French prose, African names and numbers", () => {
  assert.equal(assessText("Mardi, onze heures au bureau à répondre aux urgences WhatsApp de mon manager — mon dossier prioritaire n'a pas avancé.").ok, true);
  assert.equal(assessText("Réunion avec Nkrumah, Mbeki et N'Djamena au sujet du rapport trimestriel de l'ONG.").ok, true);
  assert.equal(assessText("Je protège 2 plages de 90 minutes par semaine, communiquées à ma hiérarchie.").ok, true);
  assert.equal(isImplausibleWord("instruction"), false);
  assert.equal(isImplausibleWord("strengths"), false);
});

test("minWords and number expectations", () => {
  const short = assessText("Oui", { minWords: 5 });
  assert.equal(short.ok, false);
  assert.equal(assessText("environ vingt cinq pour cent", { requireNumber: true }).ok, true);
  assert.equal(assessText("25 %", { requireNumber: true }).ok, true);
  const noNum = assessText("beaucoup de temps", { requireNumber: true });
  assert.equal(noNum.ok, false);
  assert.equal(fieldExpectsNumber("Demandes non planifiées — % de mon temps réel"), true);
  assert.equal(fieldExpectsNumber("Ma formulation pour ma hiérarchie"), false);
  assert.equal(hasNumber("17h30"), true);
});
