import { test } from "node:test";
import assert from "node:assert/strict";
import { applyItemOrder, Video, Exercise, ExerciseType, CourseContent } from "./index.js";

test("the shared contract exposes the canonical Zod schemas", () => {
  assert.deepEqual(ExerciseType.options, ["multi", "written", "guidedForm"]);
  assert.equal(typeof CourseContent.parse, "function");
});

test("Video schema validates a well-formed video and rejects a bad one", () => {
  const ok = Video.safeParse({ title: "Intro", durationSec: 240 });
  assert.equal(ok.success, true);
  assert.equal(Video.safeParse({ title: "x", durationSec: -1 }).success, false);
});

test("a 'multi' exercise requires options + a valid correctKey", () => {
  const bad = Exercise.safeParse({ type: "multi", prompt: "p", feedbackText: "f" });
  assert.equal(bad.success, false); // missing options/correctKey
  const good = Exercise.safeParse({
    type: "multi", prompt: "p", feedbackText: "f",
    options: [{ key: "A", label: "a" }, { key: "B", label: "b" }], correctKey: "A",
  });
  assert.equal(good.success, true);
});

test("applyItemOrder reorders by key, appends unlisted items, ignores unknown keys", () => {
  const items = [{ key: "3.1" }, { key: "3.2" }, { key: "self" }, { key: "plan" }, { key: "final" }];
  const out = applyItemOrder(items, ["3.1", "self", "3.2", "plan", "ghost", "final"]);
  assert.deepEqual(out.map((i) => i.key), ["3.1", "self", "3.2", "plan", "final"]);
  // Item added AFTER the arrangement was saved → appended, arrangement intact.
  const out2 = applyItemOrder([...items, { key: "3.3" }], ["final", "3.1"]);
  assert.deepEqual(out2.map((i) => i.key), ["final", "3.1", "3.2", "self", "plan", "3.3"]);
  // No order declared → untouched.
  assert.deepEqual(applyItemOrder(items, undefined).map((i) => i.key), items.map((i) => i.key));
});
