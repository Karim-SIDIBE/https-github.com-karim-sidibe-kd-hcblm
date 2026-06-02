import { test } from "node:test";
import assert from "node:assert/strict";
import { addEnrollment } from "./autosync";

test("addEnrollment prepends and dedupes (most-recent first)", () => {
  assert.deepEqual(addEnrollment([], "a"), ["a"]);
  assert.deepEqual(addEnrollment(["a", "b"], "c"), ["c", "a", "b"]);
  assert.deepEqual(addEnrollment(["a", "b"], "b"), ["b", "a"]);
});
