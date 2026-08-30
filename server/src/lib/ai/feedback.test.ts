import { test } from "node:test";
import assert from "node:assert/strict";

// La clé est neutralisée AVANT l'import du module (config/env est parsé à
// l'import) : ces tests couvrent le comportement hors-ligne et le mode strict.
process.env.ANTHROPIC_API_KEY = "";
const { normalize, suggestRubricScores } = await import("./feedback.js");

const criteria = [
  { label: "Organisation personnelle", weightPoints: 20, minPoints: 10 },
  { label: "Gestion des priorités", weightPoints: 20, minPoints: 10 },
  { label: "S3 — Ancrage culturel et organisationnel", weightPoints: 10 },
] as any[];

test("normalize : libellé exact, décoré (préfixe n° / code entre parenthèses), puis position", () => {
  const out = normalize(criteria, [
    { label: "1 · Organisation personnelle (D4.C1)", suggested: 15, comment: "a", citations: ["x y z a b c d e"] },
    { label: "gestion des priorités", suggested: 12, comment: "b" },
    { label: "S3 — Ancrage culturel et organisationnel", suggested: 8, comment: "c" },
  ]);
  assert.deepEqual(out.map((c) => c.suggested), [15, 12, 8]);
  assert.ok(out[0]!.citations?.length); // l'appariement décoré garde la preuve
});

test("normalize : appariement positionnel quand tous les libellés divergent mais le compte est bon", () => {
  const out = normalize(criteria, [
    { label: "Critère A", suggested: 18, comment: "" },
    { label: "Critère B", suggested: 11, comment: "" },
    { label: "Critère C", suggested: 7, comment: "" },
  ]);
  assert.deepEqual(out.map((c) => c.suggested), [18, 11, 7]);
});

test("normalize : sans appariement possible, 0 par défaut (borné au barème)", () => {
  const out = normalize(criteria, [{ label: "Inconnu", suggested: 99, comment: "" }]);
  assert.deepEqual(out.map((c) => c.suggested), [0, 0, 0]);
});

test("suggestRubricScores sans clé : repli heuristique silencieux par défaut…", async () => {
  const s = await suggestRubricScores({
    projectText: "mot ".repeat(200), criteria, threshold: 70,
  });
  assert.equal(s.aiGenerated, false);
  assert.equal(s.provider, "heuristic");
});

test("…mais ÉCHEC EXPLICITE en mode strict (calibration §8.8 — jamais mesurer le repli)", async () => {
  await assert.rejects(
    suggestRubricScores({ projectText: "texte", criteria, threshold: 70 }, { strict: true }),
    /ANTHROPIC_API_KEY non configurée/,
  );
});
