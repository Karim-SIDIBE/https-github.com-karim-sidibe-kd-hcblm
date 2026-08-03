import { test } from "node:test";
import assert from "node:assert/strict";
import { courseFunnel, parseActivityPath, questionDifficulty, timeByItem, videoCompletion } from "./insights.js";

const BASE = "https://declick.kompetences.net/xapi/courses/gestion-du-temps-n1";

test("parseActivityPath extracts block, item and question", () => {
  assert.deepEqual(parseActivityPath(`${BASE}/blocks/1/items/diagnostic/questions/d4`), {
    blockIndex: 1, itemKey: "diagnostic", questionId: "d4",
  });
  assert.deepEqual(parseActivityPath(`${BASE}/blocks/2/items/2.1/video`), {
    blockIndex: 2, itemKey: "2.1", questionId: null,
  });
  assert.deepEqual(parseActivityPath(`${BASE}/blocks/0/items/trigger`), {
    blockIndex: 0, itemKey: "trigger", questionId: null,
  });
});

test("questionDifficulty sorts hardest first and computes rates", () => {
  const rows = [
    { objectId: `${BASE}/blocks/1/items/diagnostic/questions/d1`, total: 10, correct: 9 },
    { objectId: `${BASE}/blocks/1/items/diagnostic/questions/d2`, total: 10, correct: 3 },
    { objectId: `${BASE}/blocks/3/items/final/questions/f1`, total: 4, correct: 2 },
    { objectId: `${BASE}/blocks/1/items/diagnostic`, total: 5, correct: 5 }, // no question id → dropped
  ];
  const out = questionDifficulty(rows);
  assert.equal(out.length, 3);
  assert.equal(out[0]!.questionId, "d2");
  assert.equal(out[0]!.pctCorrect, 30);
  assert.equal(out[1]!.questionId, "f1");
  assert.equal(out[2]!.pctCorrect, 90);
});

test("timeByItem collapses question-level rows into their item, averaged per learner", () => {
  const rows = [
    { objectId: `${BASE}/blocks/1/items/diagnostic/questions/d1`, enrollmentId: "e1", seconds: 30 },
    { objectId: `${BASE}/blocks/1/items/diagnostic/questions/d2`, enrollmentId: "e1", seconds: 50 },
    { objectId: `${BASE}/blocks/1/items/diagnostic/questions/d1`, enrollmentId: "e2", seconds: 40 },
    { objectId: `${BASE}/blocks/1/items/1.1`, enrollmentId: "e1", seconds: 120 },
  ];
  const out = timeByItem(rows);
  const diag = out.find((x) => x.itemKey === "diagnostic")!;
  assert.equal(diag.learners, 2);
  assert.equal(diag.avgSeconds, 60); // (80 + 40) / 2
  const ms = out.find((x) => x.itemKey === "1.1")!;
  assert.equal(ms.avgSeconds, 120);
});

test("videoCompletion averages best progress and counts ≥90% as finished", () => {
  const rows = [
    { objectId: `${BASE}/blocks/1/items/1.1/video`, enrollmentId: "e1", maxProgress: 1 },
    { objectId: `${BASE}/blocks/1/items/1.1/video`, enrollmentId: "e2", maxProgress: 0.5 },
    { objectId: `${BASE}/blocks/1/items/1.1/video`, enrollmentId: "e3", maxProgress: 0.95 },
  ];
  const out = videoCompletion(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.avgPct, 82);
  assert.equal(out[0]!.finishedPct, 67);
});

test("courseFunnel follows the canonical order and fills gaps with zero", () => {
  const required = [
    { blockIndex: 0, key: "profile", label: "Profil" },
    { blockIndex: 0, key: "trigger", label: "Quiz déclencheur" },
    { blockIndex: 1, key: "diagnostic", label: "Diagnostic" },
  ];
  const counts = [
    { blockIndex: 0, itemKey: "profile", completions: 10 },
    { blockIndex: 1, itemKey: "diagnostic", completions: 4 },
  ];
  const out = courseFunnel(required, counts, 10);
  assert.deepEqual(out.map((s) => s.pctOfEnrolled), [100, 0, 40]);
  assert.equal(out[1]!.label, "Quiz déclencheur");
});
