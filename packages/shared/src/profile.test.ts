import { test } from "node:test";
import assert from "node:assert/strict";
import { profileDivergence } from "./profile.js";

const A = { key: "A", name: "Le Débordé réactif", consistentBands: ["Réactif en éveil", "Réactif conscient"] };

test("écart énoncé quand la bande sort des bandes cohérentes de l'archétype", () => {
  const d = profileDivergence(A, "Productif maîtrisé");
  assert.deepEqual(d, { selfName: "Le Débordé réactif", bandName: "Productif maîtrisé", diverges: true });
});

test("cohérent quand la bande est déclarée compatible (comparaison insensible à la casse)", () => {
  assert.equal(profileDivergence(A, "réactif conscient")?.diverges, false);
});

test("sans correspondance déclarée : divergence inconnue (null), juxtaposition seulement", () => {
  const d = profileDivergence({ key: "B", name: "Le Procrastinateur organisé" }, "Réactif conscient");
  assert.equal(d?.diverges, null);
  assert.equal(d?.selfName, "Le Procrastinateur organisé");
});

test("rien à énoncer sans profil auto-déclaré ou sans bande", () => {
  assert.equal(profileDivergence(null, "Réactif conscient"), null);
  assert.equal(profileDivergence(A, null), null);
  assert.equal(profileDivergence(A, ""), null);
});
