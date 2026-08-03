import { test } from "node:test";
import assert from "node:assert/strict";
import { courseFunnel, detectInsightAlerts, parseActivityPath, questionDifficulty, timeByItem, videoCompletion } from "./insights.js";

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

test("detectInsightAlerts flags weak questions, funnel breaks and deserted videos — but not small samples", () => {
  const q = (id: string, total: number, pct: number) => ({
    questionId: id, label: `Question ${id}`, blockIndex: 1, itemKey: "diagnostic",
    total, correct: Math.round((total * pct) / 100), pctCorrect: pct,
  });
  const ins = {
    enrolled: 20,
    questions: [q("d1", 12, 25), q("d2", 3, 0), q("d3", 12, 80)],
    videos: [
      { blockIndex: 1, itemKey: "1.1", learners: 10, avgPct: 45, finishedPct: 30 },
      { blockIndex: 1, itemKey: "1.2", learners: 2, avgPct: 10, finishedPct: 0 },
    ],
    funnel: [
      { blockIndex: 0, itemKey: "profile", label: "Profil", completions: 20, pctOfEnrolled: 100 },
      { blockIndex: 0, itemKey: "trigger", label: "Quiz déclencheur", completions: 8, pctOfEnrolled: 40 },
      { blockIndex: 1, itemKey: "diagnostic", label: "Diagnostic", completions: 7, pctOfEnrolled: 35 },
    ],
  };
  const alerts = detectInsightAlerts(ins);
  const kinds = alerts.map((a) => a.kind).sort();
  assert.deepEqual(kinds, ["funnel", "question", "video"]);
  assert.ok(alerts.find((a) => a.kind === "question")!.label.includes("d1")); // d2 = 3 réponses → ignorée
  assert.ok(alerts.find((a) => a.kind === "video")!.label.includes("1.1")); // 1.2 = 2 spectateurs → ignorée
  assert.ok(alerts.find((a) => a.kind === "funnel")!.detail.includes("100 % à 40 %"));
});

test("detectInsightAlerts stays silent on a healthy course and a tiny cohort", () => {
  const healthy = {
    enrolled: 30,
    questions: [{ questionId: "d1", label: "Q", blockIndex: 1, itemKey: "diagnostic", total: 30, correct: 27, pctCorrect: 90 }],
    videos: [{ blockIndex: 1, itemKey: "1.1", learners: 30, avgPct: 95, finishedPct: 92 }],
    funnel: [
      { blockIndex: 0, itemKey: "profile", label: "Profil", completions: 30, pctOfEnrolled: 100 },
      { blockIndex: 1, itemKey: "diagnostic", label: "Diagnostic", completions: 26, pctOfEnrolled: 87 },
    ],
  };
  assert.equal(detectInsightAlerts(healthy).length, 0);
  const tiny = { ...healthy, enrolled: 3, funnel: healthy.funnel.map((f, i) => ({ ...f, pctOfEnrolled: i === 0 ? 100 : 0 })) };
  assert.equal(detectInsightAlerts(tiny).length, 0); // 3 inscrits < minLearners → pas de bruit
});
