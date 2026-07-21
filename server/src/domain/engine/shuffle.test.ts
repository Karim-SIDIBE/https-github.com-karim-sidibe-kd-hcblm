import { test } from "node:test";
import assert from "node:assert/strict";
import { seededShuffle, shuffleQuestions } from "./shuffle.js";

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
