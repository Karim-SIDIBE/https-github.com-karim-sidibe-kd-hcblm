import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateCompetencies } from "./competency.js";

const sa = (subArea: string, pct: number) => ({ subArea, correct: 0, total: 0, pct });

test("averages each sub-area across learners, weakest first", () => {
  const out = aggregateCompetencies([
    [sa("Priorisation", 40), sa("Délégation", 80)],
    [sa("Priorisation", 60), sa("Délégation", 100)],
    [sa("Priorisation", 20)], // a learner who only has one area
  ]);
  assert.deepEqual(out, [
    { subArea: "Priorisation", avgPct: 40, learners: 3 }, // (40+60+20)/3
    { subArea: "Délégation", avgPct: 90, learners: 2 },   // (80+100)/2
  ]);
});

test("empty input → empty result", () => {
  assert.deepEqual(aggregateCompetencies([]), []);
});

test("ignores malformed entries", () => {
  const out = aggregateCompetencies([[sa("X", 50), { subArea: "X" } as any]]);
  assert.deepEqual(out, [{ subArea: "X", avgPct: 50, learners: 1 }]);
});
