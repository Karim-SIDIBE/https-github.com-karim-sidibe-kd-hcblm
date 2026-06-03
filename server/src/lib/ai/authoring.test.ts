import { test } from "node:test";
import assert from "node:assert/strict";
import { buildScaffold } from "./authoring.js";
import { validateShape, validatePolicy } from "../../domain/validation.js";

test("scaffold for a Niveau 2 course is shape- and policy-valid", () => {
  const content = buildScaffold({ domainCode: "D5", domainLabel: "Communication", level: 2 });
  const s = validateShape(content);
  assert.equal(s.ok, true);
  if (!s.ok) return;
  const p = validatePolicy(s.content);
  assert.equal(p.publishable, true, JSON.stringify(p.issues.filter((i) => i.level === "error")));
});

test("scaffold thresholds follow the level", () => {
  const c2: any = buildScaffold({ domainCode: "D5", domainLabel: "X", level: 2 });
  assert.equal(c2.passThreshold, 75);
  assert.equal(c2.blocks[3].payload.finalQuiz.passThreshold, 75);
  assert.equal(c2.blocks[4].payload.rubric.threshold, 75);
  const sum = c2.blocks[4].payload.rubric.criteria.reduce((a: number, x: any) => a + x.weightPoints, 0);
  assert.equal(sum, 100);
  const c3: any = buildScaffold({ domainCode: "D5", domainLabel: "X", level: 3 });
  assert.equal(c3.passThreshold, 80);
});
