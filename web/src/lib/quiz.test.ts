import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreQuiz, diagnosticProfile } from "./quiz";

const qs = [
  { id: "d1", correctKey: "A", subArea: "priorisation" },
  { id: "d2", correctKey: "B", subArea: "priorisation" },
  { id: "d3", correctKey: "C", subArea: "planification" },
  { id: "d4", correctKey: "D", subArea: "délégation" },
];

test("scoreQuiz counts correct answers and percentage", () => {
  assert.deepEqual(scoreQuiz(qs, { d1: "A", d2: "X", d3: "C", d4: "X" }), { correct: 2, total: 4, scorePct: 50 });
});

test("diagnosticProfile surfaces the two weakest sub-areas as priorities", () => {
  // priorisation 1/2 (50%), planification 1/1 (100%), délégation 0/1 (0%)
  const p = diagnosticProfile(qs, { d1: "A", d2: "X", d3: "C", d4: "X" });
  assert.deepEqual(p.priorities, ["délégation", "priorisation"]); // 0% then 50%
  assert.equal(p.subAreaScores.find((s) => s.subArea === "planification")!.pct, 100);
});

test("missing subArea falls back to 'général'", () => {
  const p = diagnosticProfile([{ id: "x", correctKey: "A" }], { x: "B" });
  assert.equal(p.subAreaScores[0]!.subArea, "général");
  assert.deepEqual(p.priorities, ["général"]);
});
