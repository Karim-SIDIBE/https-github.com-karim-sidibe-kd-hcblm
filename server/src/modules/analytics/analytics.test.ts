import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./analytics.service.js";

test("toCsv emits a header row + data rows", () => {
  const csv = toCsv([{ name: "Awa", status: "CERTIFIED", score: 85 }, { name: "Koffi", status: "ACTIVE", score: null }]);
  const lines = csv.split("\n");
  assert.equal(lines[0], "name,status,score");
  assert.equal(lines[1], "Awa,CERTIFIED,85");
  assert.equal(lines[2], "Koffi,ACTIVE,"); // null → empty
});

test("toCsv escapes commas, quotes and newlines", () => {
  const csv = toCsv([{ name: 'Diallo, "A"', note: "ligne1\nligne2" }]);
  // The embedded newline lives inside a quoted field, so compare the whole string.
  assert.equal(csv, 'name,note\n"Diallo, ""A""","ligne1\nligne2"');
});

test("toCsv on empty input is empty", () => {
  assert.equal(toCsv([]), "");
});

test("summarizeInsights compresses a segment into comparable headline numbers", async () => {
  const { summarizeInsights } = await import("./analytics.service.js");
  const ins = {
    enrolled: 10,
    questions: [
      { questionId: "d1", label: "Q1", blockIndex: 1, itemKey: "diagnostic", total: 10, correct: 8, pctCorrect: 80 },
      { questionId: "d2", label: "Q2", blockIndex: 1, itemKey: "diagnostic", total: 10, correct: 4, pctCorrect: 40 },
    ],
    time: [],
    videos: [
      { blockIndex: 1, itemKey: "1.1", learners: 5, avgPct: 90, finishedPct: 80 },
      { blockIndex: 1, itemKey: "1.2", learners: 5, avgPct: 60, finishedPct: 40 },
    ],
    funnel: [
      { blockIndex: 0, itemKey: "profile", label: "Profil", completions: 10, pctOfEnrolled: 100 },
      { blockIndex: 4, itemKey: "rubric", label: "Grille", completions: 3, pctOfEnrolled: 30 },
    ],
  } as Awaited<ReturnType<typeof import("./analytics.service.js").courseInsights>>;
  const s = summarizeInsights(ins);
  assert.deepEqual(s, { enrolled: 10, avgQuestionPct: 60, funnelEndPct: 30, avgVideoFinishedPct: 60 });
});

test("summarizeInsights on an empty segment yields nulls, not NaN", async () => {
  const { summarizeInsights } = await import("./analytics.service.js");
  const empty = { enrolled: 0, questions: [], time: [], videos: [], funnel: [] } as unknown as
    Awaited<ReturnType<typeof import("./analytics.service.js").courseInsights>>;
  assert.deepEqual(summarizeInsights(empty), { enrolled: 0, avgQuestionPct: null, funnelEndPct: 0, avgVideoFinishedPct: null });
});
