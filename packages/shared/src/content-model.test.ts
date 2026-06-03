import { test } from "node:test";
import assert from "node:assert/strict";
import { Video, Exercise, ExerciseType, CourseContent } from "./index.js";

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
