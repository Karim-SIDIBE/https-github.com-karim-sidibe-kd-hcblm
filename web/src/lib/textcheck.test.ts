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

test("A4 : le lorem ipsum est refusé comme texte de remplissage", () => {
  const full = assessText("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.");
  assert.equal(full.ok, false);
  assert.equal((full as { code: string }).code, "filler");
  // Même noyé dans une vraie phrase : deux mots signature suffisent.
  const mixed = assessText("Voici ma réponse sérieuse : lorem ipsum et ensuite je continue normalement mon paragraphe sur la gestion du temps au bureau.");
  assert.equal((mixed as { code?: string }).code, "filler");
});

test("A4 : un seul mot signature ne bloque pas (jamais de faux positif sur une citation)", () => {
  const one = assessText("Le modèle « lorem » est un exemple classique de faux texte utilisé par les imprimeurs depuis le XVIe siècle pour caler leurs maquettes.");
  assert.equal(one.ok, true);
  // « sed », « sit », « in »… absents de la liste : le français/anglais réel passe.
  assert.equal(assessText("Je m'assois (sit) et je prépare mon planning du jour avec sérieux.").ok, true);
});
