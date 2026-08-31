import { test } from "node:test";
import assert from "node:assert/strict";

// La clé est neutralisée AVANT l'import du module (config/env est parsé à
// l'import) : ces tests couvrent le comportement hors-ligne et le mode strict.
process.env.ANTHROPIC_API_KEY = "";
const { buildFormativeRequest, buildRubricRequest, normalize, rubricOutputConfig, suggestRubricScores } = await import("./feedback.js");
const { effortFor } = await import("./client.js");

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

test("effort : envoyé seulement aux modèles qui le supportent (claude-haiku-4-5 le rejette)", () => {
  assert.deepEqual(effortFor("claude-sonnet-5", "low"), { effort: "low" });
  assert.deepEqual(effortFor("claude-opus-5", "medium"), { effort: "medium" });
  assert.equal(effortFor("claude-haiku-4-5-20251001", "low"), undefined);
  assert.equal(effortFor("claude-haiku-4-5", "low"), undefined);
});

test("effort par fonction : minimal pour le feedback formatif, défaut pour la notation certifiante", () => {
  const formative = buildFormativeRequest({ submissionText: "texte", itemLabel: "1.5", competencies: [] });
  const rubric = buildRubricRequest({ projectText: "texte", criteria, threshold: 70 });
  // Sous l'env de test (haiku), le paramètre doit être ABSENT des deux…
  assert.equal(formative.output_config, undefined);
  assert.equal(rubric.output_config, undefined);
  // …et sur un modèle capable, seul le feedback réclame « low » — la notation
  // garde le défaut (justesse d'abord), matérialisé par l'absence du champ.
  const patched = { ...formative, output_config: effortFor("claude-sonnet-5", "low") };
  assert.deepEqual(patched.output_config, { effort: "low" });
});

test("notation : sortie structurée (JSON garanti) sur modèle capable, sans effort ; rien sur haiku", () => {
  const cfg = rubricOutputConfig("claude-sonnet-5");
  assert.equal(cfg?.format?.type, "json_schema");
  assert.equal(cfg?.effort, undefined); // la justesse garde la réflexion par défaut
  const schema = cfg?.format?.schema as Record<string, any>;
  assert.deepEqual(schema.required, ["perCriterion", "summary"]);
  // citations/absence toujours présents (vides autorisés) — normalize neutralise
  assert.ok((schema.properties.perCriterion.items.required as string[]).includes("citations"));
  assert.equal(rubricOutputConfig("claude-haiku-4-5-20251001"), undefined);
});

test("normalize : citations vide et absence vide (sortie structurée) valent omission", () => {
  const out = normalize(criteria, [
    { label: "Organisation personnelle", suggested: 15, comment: "a", citations: [], absence: "" },
  ]);
  assert.equal(out[0]!.citations, undefined);
  assert.equal(out[0]!.absence, undefined);
});
