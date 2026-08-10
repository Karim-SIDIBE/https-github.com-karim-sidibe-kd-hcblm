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
  c.blocks.forEach((b: any) => b.payload.microSessions?.forEach((m: any) => { if (m.exercise) m.exercise.prompt = "x"; }));
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

// --- K-HCBLM v2.2 (amendements A1 / A2) --------------------------------------

test("A2 : un écart entre la somme des micro-tâches et la durée annoncée bloque la publication", () => {
  const s = validateShape(n1Full);
  assert.ok(s.ok);
  const c: any = structuredClone(s.ok && s.content);
  const journal = c.blocks[4].units.find((u: any) => u.children?.length);
  journal.children[0].durationMin = 10; // 6 entrées : 10+5×5 = 35 ≠ 30 annoncées
  const p = validatePolicy(c);
  assert.equal(p.publishable, false);
  assert.ok(p.issues.some((i) => i.rule === "units.durationAudit" && i.level === "error"));
});

test("A2 : le parcours canonique passe le contrôle d'auditabilité (6 × 5 = 30)", () => {
  const s = validateShape(n1Full);
  assert.ok(s.ok);
  const p = validatePolicy((s as any).content);
  assert.equal(p.publishable, true);
  assert.ok(!p.issues.some((i) => i.rule === "units.durationAudit"));
});

test("A1 : un Bloc 0 découpé en plusieurs micro-sessions lève un avertissement (sans bloquer)", () => {
  const s = validateShape(n1Full);
  assert.ok(s.ok);
  const c: any = structuredClone(s.ok && s.content);
  c.blocks[0].units = [
    { label: "MS 0.1", type: "micro-session", durationMin: 10 },
    { label: "MS 0.2", type: "micro-session", durationMin: 10 },
  ];
  const p = validatePolicy(c);
  assert.equal(p.publishable, true); // warning, pas erreur
  assert.ok(p.issues.some((i) => i.rule === "bloc0.singleSession" && i.level === "warning"));
});

test("v2.2 : quiz déclencheur ≠ 5 questions et profils ≠ 4 archétypes lèvent des avertissements", () => {
  const s = validateShape(n1Full);
  assert.ok(s.ok);
  const c: any = structuredClone(s.ok && s.content);
  c.blocks[0].payload.triggerQuiz.questions = c.blocks[0].payload.triggerQuiz.questions.slice(0, 3);
  c.blocks[0].payload.profileChoices = c.blocks[0].payload.profileChoices.slice(0, 2);
  const p = validatePolicy(c);
  assert.equal(p.publishable, true);
  assert.ok(p.issues.some((i) => i.rule === "bloc0.triggerQuiz"));
  assert.ok(p.issues.some((i) => i.rule === "bloc0.profiles"));
});

test("v2.2 : une vidéo de plus de 10 minutes lève un avertissement", () => {
  const s = validateShape(n1Full);
  assert.ok(s.ok);
  const c: any = structuredClone(s.ok && s.content);
  c.blocks[1].payload.microSessions[0].video.durationSec = 900; // 15 min
  const p = validatePolicy(c);
  assert.equal(p.publishable, true);
  assert.ok(p.issues.some((i) => i.rule === "video.max10min"));
});
