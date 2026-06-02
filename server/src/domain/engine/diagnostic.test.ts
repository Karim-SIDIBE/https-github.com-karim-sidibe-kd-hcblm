import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticProfile } from "./progress.js";

const qs = [
  { id: "a", correctKey: "A", subArea: "priorisation" },
  { id: "b", correctKey: "B", subArea: "priorisation" },
  { id: "c", correctKey: "C", subArea: "interruptions" },
  { id: "d", correctKey: "D", subArea: "délégation" },
];

test("diagnostic breaks the score down by sub-area", () => {
  // priorisation 1/2 (50%), interruptions 0/1 (0%), délégation 1/1 (100%)
  const p = diagnosticProfile(qs, { a: "A", b: "X", c: "X", d: "D" });
  assert.equal(p.correct, 2);
  assert.equal(p.scorePct, 50);
  const pri = p.subAreaScores.find((s) => s.subArea === "priorisation")!;
  assert.equal(pri.pct, 50);
  assert.equal(p.subAreaScores.find((s) => s.subArea === "interruptions")!.pct, 0);
});

test("the two weakest sub-areas become the learning priorities", () => {
  const p = diagnosticProfile(qs, { a: "A", b: "X", c: "X", d: "D" });
  assert.equal(p.priorities.length, 2);
  // weakest first: interruptions (0%) then priorisation (50%)
  assert.equal(p.priorities[0]!.subArea, "interruptions");
  assert.equal(p.priorities[1]!.subArea, "priorisation");
});

test("questions without a sub-area fall under 'général'", () => {
  const p = diagnosticProfile([{ id: "x", correctKey: "A" }], { x: "B" });
  assert.equal(p.subAreaScores[0]!.subArea, "général");
});
