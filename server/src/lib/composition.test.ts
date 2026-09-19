import { test } from "node:test";
import assert from "node:assert/strict";
import { CompositionCapture, computeIndicators, journalWindows, journalFieldKey, sectionFieldKey, SECTION_FIELD_KEYS } from "./composition.js";

const DAY = 86_400_000;
const base = {
  device: "desktop" as const,
  firstInputAt: new Date("2026-09-01T10:00:00Z"),
  charsTotal: 600,
  charsComposed: 600,
  charsPasted: 0,
  deleteEvents: 12,
  retouchesAfterPaste: 0,
  sessions: 1,
};

test("annexe §3 — champ composé au clavier : taux de dépôt nul, retouche sans objet", () => {
  const ind = computeIndicators(base, new Date("2026-09-01T10:10:00Z"));
  assert.equal(ind.depositRate, 0);
  assert.equal(ind.retouchRate, null); // aucun collage → pas de taux
  assert.equal(Math.round(ind.density), 60); // 600 caractères en 10 minutes
  assert.equal(ind.spread, null); // pas une micro-entrée de journal
});

test("annexe §3 — collage massif sans retouche : le profil que la combinaison cible", () => {
  const ind = computeIndicators(
    { ...base, charsComposed: 20, charsPasted: 580, retouchesAfterPaste: 0 },
    new Date("2026-09-01T10:00:08Z"), // soumis en 8 secondes
  );
  assert.ok(ind.depositRate > 0.95);
  assert.equal(ind.retouchRate, 0); // collé et laissé tel quel
  assert.ok(ind.density > 1000); // densité incompatible avec une composition
});

test("annexe §3 — un brouillon personnel collé PUIS retravaillé garde un taux de retouche non nul", () => {
  const ind = computeIndicators(
    { ...base, charsComposed: 80, charsPasted: 520, retouchesAfterPaste: 26 },
    new Date("2026-09-01T10:12:00Z"),
  );
  assert.equal(ind.retouchRate, 26 / 520);
});

test("étalement : entrée soumise à l'ouverture de sa fenêtre ≈ 0, en fin de fenêtre ≈ 1", () => {
  const started = new Date("2026-09-01T00:00:00Z");
  const windows = journalWindows(started, [2, 4, 6, 9, 11, 15]);
  const w2 = windows.get(2)!;
  assert.equal(w2.widthMs, 2 * DAY); // fenêtre J+2 → J+4
  const atOpen = computeIndicators(base, new Date(w2.opensAt.getTime() + 3600e3), w2);
  const atClose = computeIndicators(base, new Date(w2.opensAt.getTime() + 2 * DAY), w2);
  assert.ok(atOpen.spread! < 0.05);
  assert.ok(Math.abs(atClose.spread! - 1) < 0.01);
  // Dernière entrée : la largeur reprend l'intervalle précédent (11 → 15).
  assert.equal(windows.get(15)!.widthMs, 4 * DAY);
});

test("identifiants fonctionnels de l'annexe §1", () => {
  assert.equal(journalFieldKey(9), "bloc4.journal.J+9");
  assert.equal(SECTION_FIELD_KEYS[0], "bloc4.situation");
  assert.equal(SECTION_FIELD_KEYS[4], "bloc4.apprentissage");
  assert.equal(SECTION_FIELD_KEYS[3], undefined); // Section 4 auto-composée : jamais saisie, jamais instrumentée
  // La Section 1 porte la clé historique « project » (sans suffixe).
  assert.equal(sectionFieldKey("project"), "bloc4.situation");
  assert.equal(sectionFieldKey("project@2"), "bloc4.resultat");
  assert.equal(sectionFieldKey("project@3"), null);
  assert.equal(sectionFieldKey("autre"), null);
});

test("le schéma de capture refuse un profil malformé", () => {
  assert.equal(CompositionCapture.safeParse({ device: "tablette" }).success, false);
  assert.equal(CompositionCapture.safeParse({
    device: "mobile", firstInputAt: "2026-09-01T10:00:00Z", charsTotal: 100, charsComposed: 100,
    charsPasted: 0, deleteEvents: 0, retouchesAfterPaste: 0, sessions: 1,
  }).success, true);
});
