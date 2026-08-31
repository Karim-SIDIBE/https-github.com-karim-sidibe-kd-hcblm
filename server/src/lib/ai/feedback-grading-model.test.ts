import { test } from "node:test";
import assert from "node:assert/strict";

// Fichier séparé (processus node --test dédié) : l'env est figé AVANT l'import
// du module — on peut donc tester la bascule AI_GRADING_MODEL sans toucher aux
// assertions « défaut » de feedback.test.ts.
process.env.ANTHROPIC_API_KEY = "";
process.env.AI_GRADING_MODEL = "claude-opus-5";
const { buildFormativeRequest, buildRubricRequest, gradingModel } = await import("./feedback.js");

test("AI_GRADING_MODEL : la NOTATION seule bascule, le feedback formatif reste sur AI_MODEL", () => {
  assert.equal(gradingModel(), "claude-opus-5");
  const rubric = buildRubricRequest({ projectText: "texte", criteria: [], threshold: 70 });
  assert.equal(rubric.model, "claude-opus-5");
  // Modèle capable → sortie structurée jointe, toujours sans effort réduit.
  assert.equal(rubric.output_config?.format?.type, "json_schema");
  assert.equal(rubric.output_config?.effort, undefined);
  // Le feedback formatif, lui, garde le modèle général (haiku par défaut ici).
  const formative = buildFormativeRequest({ submissionText: "texte", itemLabel: "1.5", competencies: [] });
  assert.notEqual(formative.model, "claude-opus-5");
});
