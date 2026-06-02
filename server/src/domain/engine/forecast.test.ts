import { test } from "node:test";
import assert from "node:assert/strict";
import { forecastCompletion } from "./forecast.js";

const base = { blocksTotal: 5, certified: false, terminated: false };

test("empty population forecasts zero", () => {
  const f = forecastCompletion([]);
  assert.equal(f.forecastPercent, 0);
  assert.equal(f.enrollments, 0);
});

test("certified learners count fully; terminated count zero", () => {
  const f = forecastCompletion([
    { ...base, blocksCompleted: 5, daysSinceStart: 20, certified: true },
    { ...base, blocksCompleted: 1, daysSinceStart: 30, terminated: true },
  ]);
  assert.equal(f.certified, 1);
  assert.equal(f.currentPercent, 50);
  // one full (1) + one zero (0) over 2 → 50%
  assert.equal(f.forecastPercent, 50);
});

test("on-pace in-progress learner is projected to complete", () => {
  // 2 blocks in 10 days → 0.2/day; over 90d horizon → 2 + 18 = 20 ≫ 5 → capped to 1.
  const f = forecastCompletion([{ ...base, blocksCompleted: 2, daysSinceStart: 10 }], 90);
  assert.equal(f.forecastPercent, 100);
  assert.equal(f.currentPercent, 0); // none certified yet
});

test("stalled learner (no progress) forecasts zero contribution", () => {
  const f = forecastCompletion([{ ...base, blocksCompleted: 0, daysSinceStart: 40 }], 90);
  assert.equal(f.forecastPercent, 0);
});

test("forecast sits above current completion for active cohorts", () => {
  const f = forecastCompletion([
    { ...base, blocksCompleted: 5, daysSinceStart: 30, certified: true },
    { ...base, blocksCompleted: 3, daysSinceStart: 30 }, // slow but progressing
    { ...base, blocksCompleted: 1, daysSinceStart: 60 }, // very slow
  ], 60);
  assert.ok(f.forecastPercent >= f.currentPercent);
});
