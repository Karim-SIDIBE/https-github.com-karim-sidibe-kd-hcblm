import { test } from "node:test";
import assert from "node:assert/strict";
import { competencyLabels } from "./competencies.js";

test("competencyLabels : libellés du contenu, dédupliqués, sans les codes", () => {
  const content = {
    competencies: [
      { code: "D1.C1", label: "Clarté et structuration du message" },
      { code: "D1.C2", label: "Écoute active et reformulation" },
      { code: "D1.C2b", label: "Écoute active et reformulation" }, // doublon de libellé
      { code: "D1.C3", label: "  " }, // libellé vide → ignoré
    ],
  };
  assert.deepEqual(competencyLabels(content), [
    "Clarté et structuration du message",
    "Écoute active et reformulation",
  ]);
  // Les codes ne fuient jamais dans la liste.
  assert.ok(competencyLabels(content).every((l) => !/^D\d+\.C\d+/.test(l)));
});

test("competencyLabels : tolérant aux contenus partiels ou absents", () => {
  assert.deepEqual(competencyLabels(null), []);
  assert.deepEqual(competencyLabels({}), []);
  assert.deepEqual(competencyLabels({ competencies: "oops" }), []);
  assert.deepEqual(competencyLabels({ competencies: [{}, { label: 3 }] }), []);
});
