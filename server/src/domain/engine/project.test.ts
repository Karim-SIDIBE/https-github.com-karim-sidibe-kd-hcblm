import { test } from "node:test";
import assert from "node:assert/strict";
import { composeJournalChapter, journalUnlockAt, PROJECT_SECTION_MIN_WORDS, wordCount } from "./project.js";

test("wordCount : blancs multiples, sauts de ligne, texte vide", () => {
  assert.equal(wordCount("un  deux\n\ntrois\tquatre "), 4);
  assert.equal(wordCount("   "), 0);
  assert.equal(wordCount(""), 0);
});

test("plancher de section : 30 mots — un texte télégraphique est en dessous, un paragraphe rédigé au-dessus", () => {
  const telegraphique = "Problème : interruptions. Solution : liste. Résultat : mieux.";
  assert.equal(wordCount(telegraphique) < PROJECT_SECTION_MIN_WORDS, true);
  const redige = "Dans mon agence de transit à Douala, je perdais chaque matin le fil de mes dossiers " +
    "prioritaires à cause des visites imprévues ; depuis le 12 juin, je bloque une plage de deux heures " +
    "avant l'ouverture et je traite les demandes sur rendez-vous, ce qui m'a permis de rendre trois dossiers en avance.";
  assert.equal(wordCount(redige) >= PROJECT_SECTION_MIN_WORDS, true);
});

test("composeJournalChapter : entrées ordonnées par jour, préfixe J+n", () => {
  const ch = composeJournalChapter([
    { day: 4, text: "Deuxième note." },
    { day: 2, text: "Première note." },
  ]);
  assert.equal(ch, "J+2 : Première note.\n\nJ+4 : Deuxième note.");
});

test("journalUnlockAt : J+n = n jours après l'ancrage", () => {
  const start = new Date("2026-08-01T10:00:00Z");
  assert.equal(journalUnlockAt(start, 2).toISOString(), "2026-08-03T10:00:00.000Z");
});
