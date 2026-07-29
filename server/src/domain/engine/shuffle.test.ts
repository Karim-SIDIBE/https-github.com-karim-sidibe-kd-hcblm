import { test } from "node:test";
import assert from "node:assert/strict";
import { seededShuffle, shuffleQuestions, shuffleQuestionOptions } from "./shuffle.js";

const ids = (a: { id: string }[]) => a.map((q) => q.id);
const qs = Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}` }));

test("same seed → same order; different seeds → different orders", () => {
  const a = seededShuffle(qs, "enr-1:diagnostic");
  const b = seededShuffle(qs, "enr-1:diagnostic");
  const c = seededShuffle(qs, "enr-2:diagnostic");
  assert.deepEqual(ids(a), ids(b)); // stable per learner
  assert.notDeepEqual(ids(a), ids(c)); // varies across learners
  assert.deepEqual([...ids(a)].sort(), [...ids(qs)].sort()); // permutation, nothing lost
  assert.deepEqual(ids(qs), qs.map((q) => q.id)); // input untouched
});

test("profiling questions stay pinned at the end", () => {
  const withProfiling = [...qs.slice(0, 9), { id: "q10", profiling: true }];
  for (const seed of ["e1:diagnostic", "e2:diagnostic", "e3:diagnostic"]) {
    const out = shuffleQuestions(withProfiling, seed);
    assert.equal(out[out.length - 1]!.id, "q10");
    assert.equal(out.length, 10);
  }
});

test("shuffleQuestionOptions re-letters options and remaps the correct key", () => {
  const q = { id: "d1", options: [
    { key: "A", label: "opt-a" }, { key: "B", label: "opt-b" }, { key: "C", label: "opt-c" }, { key: "D", label: "opt-d" },
  ], correctKey: "B" };
  const out = shuffleQuestionOptions(q, "e1:diagnostic");
  // Deterministic: same seed → same permutation.
  assert.deepEqual(out, shuffleQuestionOptions(q, "e1:diagnostic"));
  // Letters read A–D in the new order…
  assert.deepEqual(out.options!.map((o) => o.key), ["A", "B", "C", "D"]);
  // …and the remapped correct key still points at the SAME answer text.
  assert.equal(out.options!.find((o) => o.key === out.correctKey)!.label, "opt-b");
  // Another learner gets a different arrangement (with 4 options this seed pair differs).
  const other = shuffleQuestionOptions(q, "e2:diagnostic");
  assert.notDeepEqual(other.options!.map((o) => o.label), out.options!.map((o) => o.label));
});

test("shuffleQuestionOptions leaves profiling and non-MCQ questions untouched", () => {
  const prof = { id: "d10", profiling: true, options: [{ key: "A", label: "a" }, { key: "B", label: "b" }], correctKey: "B" };
  assert.deepEqual(shuffleQuestionOptions(prof, "e1:diagnostic"), prof);
  const tf = { id: "t1", type: "truefalse", options: undefined as never, correctKey: undefined };
  assert.deepEqual(shuffleQuestionOptions(tf, "e1:diagnostic"), tf);
});
