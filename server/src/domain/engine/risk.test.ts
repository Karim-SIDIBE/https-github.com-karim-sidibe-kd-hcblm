import { test } from "node:test";
import assert from "node:assert/strict";
import { dropoutRisk, type RiskFeatures } from "./risk.js";

const base: RiskFeatures = {
  certified: false, completed: false, daysSinceActivity: 0, daysSinceStart: 1,
  progressPercent: 30, pamCaptured: true, diagnosticScore: 80, failedFinal: false, nudgesSent: 0,
};

test("a finished learner is never at risk", () => {
  assert.deepEqual(dropoutRisk({ ...base, certified: true, daysSinceActivity: 99 }), { score: 0, level: "low", factors: [] });
  assert.equal(dropoutRisk({ ...base, completed: true }).score, 0);
});

test("an active, progressing learner is low risk", () => {
  const r = dropoutRisk(base);
  assert.equal(r.level, "low");
  assert.ok(r.score < 30);
});

test("long inactivity + no start = high risk, explained", () => {
  const r = dropoutRisk({ ...base, daysSinceActivity: 20, daysSinceStart: 20, progressPercent: 0, pamCaptured: false, nudgesSent: 2 });
  assert.equal(r.level, "high");
  assert.ok(r.score >= 60);
  assert.equal(r.factors[0]!.label, "Inactif depuis 20 jours"); // strongest factor first
  assert.ok(r.factors.some((f) => /jamais commencé/.test(f.label)));
});

test("score is capped at 100", () => {
  const r = dropoutRisk({ ...base, daysSinceActivity: 30, daysSinceStart: 30, progressPercent: 0, pamCaptured: false, diagnosticScore: 10, failedFinal: true, nudgesSent: 3 });
  assert.equal(r.score, 100);
});

test("moderate inactivity → medium with a clear reason", () => {
  const r = dropoutRisk({ ...base, daysSinceActivity: 8, daysSinceStart: 10, progressPercent: 15 });
  assert.equal(r.level, "medium");
  assert.ok(r.factors.length >= 1);
});

test("factors carry points and the sum (capped) is the score", () => {
  const r = dropoutRisk({ ...base, daysSinceActivity: 7, daysSinceStart: 8, progressPercent: 10 });
  assert.equal(r.score, Math.min(100, r.factors.reduce((s, f) => s + f.points, 0)));
});
