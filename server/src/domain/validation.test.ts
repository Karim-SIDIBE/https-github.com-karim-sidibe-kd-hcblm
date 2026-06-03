import { test } from "node:test";
import assert from "node:assert/strict";
import { validateShape, validatePolicy } from "./validation.js";
import { n1Full } from "./fixtures/n1-full.js";

test("the real Niveau 1 course passes shape + policy", () => {
  const s = validateShape(n1Full);
  assert.equal(s.ok, true);
  if (!s.ok) return;
  const p = validatePolicy(s.content);
  assert.equal(p.publishable, true);
  assert.equal(p.issues.filter((i) => i.level === "error").length, 0);
});

test("missing title fails the shape gate", () => {
  const bad: any = structuredClone(n1Full);
  delete bad.title;
  assert.equal(validateShape(bad).ok, false);
});

test("rubric not summing to 100 fails policy", () => {
  const s = validateShape(n1Full);
  assert.ok(s.ok);
  const c: any = structuredClone(s.ok && s.content);
  c.blocks[4].payload.rubric.criteria[0].weightPoints = 5;
  const p = validatePolicy(c);
  assert.equal(p.publishable, false);
  assert.ok(p.issues.some((i) => i.rule === "rubric.total"));
});

test("stripping the Moment d'Ancrage token fails policy", () => {
  const s = validateShape(n1Full);
  assert.ok(s.ok);
  const c: any = structuredClone(s.ok && s.content);
  c.blocks[4].payload.projectBrief = "sans jeton";
  c.blocks[4].payload.journal.entries.forEach((e: any) => (e.prompt = "x"));
  c.blocks.forEach((b: any) => b.payload.microSessions?.forEach((m: any) => (m.exercise.prompt = "x")));
  const p = validatePolicy(c);
  assert.ok(p.issues.some((i) => i.rule.startsWith("pam.")));
});

test("level threshold mismatch fails policy", () => {
  const s = validateShape(n1Full);
  assert.ok(s.ok);
  const c: any = structuredClone(s.ok && s.content);
  c.passThreshold = 90; // Niveau 1 expects 70
  const p = validatePolicy(c);
  assert.ok(p.issues.some((i) => i.rule === "threshold.level"));
});
