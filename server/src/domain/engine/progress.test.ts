import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProgress, scoreQuiz, blockRequirements, type CompletionRecord } from "./progress.js";
import { validateShape } from "../validation.js";
import { n1Full } from "../fixtures/n1-full.js";

const content = (() => { const s = validateShape(n1Full); if (!s.ok) throw new Error("fixture invalid"); return s.content; })();

test("fresh enrolment: Bloc 0 available, others locked", () => {
  const p = computeProgress(content, [], false);
  assert.equal(p.blocks[0]!.state, "available");
  assert.equal(p.blocks[1]!.state, "locked");
  assert.equal(p.courseCompleted, false);
});

test("productivity score (dispositif #2): 0 fresh, rises with completion, reflects quiz scores", () => {
  // Fresh enrolment → no units earned.
  assert.equal(computeProgress(content, [], false).productivity.score, 0);

  // Capturing the Moment d'Ancrage alone already moves the score (Pilier 6.5).
  const pamOnly = computeProgress(content, [], true).productivity;
  assert.ok(pamOnly.score > 0, "PAM should move the score off zero");

  // A scored item earns only its score fraction, not a full unit.
  const lowQuiz: CompletionRecord[] = [{ blockIndex: 0, itemKey: "trigger", scorePct: null }];
  const half = computeProgress(content, [...lowQuiz, { blockIndex: 1, itemKey: "diagnostic", scorePct: 50 }], true).productivity;
  const full = computeProgress(content, [...lowQuiz, { blockIndex: 1, itemKey: "diagnostic", scorePct: 100 }], true).productivity;
  assert.ok(full.earned > half.earned, "higher quiz score earns more");

  // Fully completing every required item with perfect scores → 100.
  const all: CompletionRecord[] = content.blocks.flatMap((b) =>
    blockRequirements(b).map((r) => ({ blockIndex: b.index, itemKey: r.key, scorePct: r.minScore != null ? 100 : null })));
  assert.equal(computeProgress(content, all, true).productivity.score, 100);
});

test("Bloc 0 needs the Moment d'Ancrage even with items done", () => {
  const recs: CompletionRecord[] = [
    { blockIndex: 0, itemKey: "profile", scorePct: null },
    { blockIndex: 0, itemKey: "trigger", scorePct: null },
    { blockIndex: 0, itemKey: "peer", scorePct: null },
  ];
  assert.equal(computeProgress(content, recs, false).blocks[0]!.state, "available"); // PAM missing
  assert.equal(computeProgress(content, recs, true).blocks[0]!.state, "completed");
});

test("PRACTICE requires the inter-block quiz when present", () => {
  const practice = content.blocks[2]!;
  const keys = blockRequirements(practice).map((r) => r.key);
  assert.ok(keys.includes("interblock"));
  assert.ok(keys.includes("field"));
});

test("final quiz below threshold does not complete Bloc 3", () => {
  const anchoring = content.blocks[3]!;
  const baseKeys = blockRequirements(anchoring).filter((r) => r.key !== "final").map((r) => r.key);
  const recs: CompletionRecord[] = baseKeys.map((k) => ({ blockIndex: 3, itemKey: k, scorePct: null }));
  const fail = [...recs, { blockIndex: 3, itemKey: "final", scorePct: 50 }];
  const pass = [...recs, { blockIndex: 3, itemKey: "final", scorePct: 80 }];
  // Bloc 3 is locked until earlier blocks done; check the failedThreshold signal directly.
  const bpFail = computeProgress(content, fail, true).blocks[3]!;
  assert.deepEqual(bpFail.failedThreshold, { key: "final", need: 70, got: 50 });
  const bpPass = computeProgress(content, pass, true).blocks[3]!;
  assert.equal(bpPass.failedThreshold, undefined);
});

test("scoreQuiz computes a percentage", () => {
  const qs = [{ id: "a", correctKey: "A" }, { id: "b", correctKey: "B" }, { id: "c", correctKey: "C" }];
  assert.deepEqual(scoreQuiz(qs, { a: "A", b: "B", c: "C" }), { scorePct: 100, correct: 3, total: 3 });
  assert.equal(scoreQuiz(qs, { a: "A", b: "X", c: "X" }).scorePct, 33);
});
