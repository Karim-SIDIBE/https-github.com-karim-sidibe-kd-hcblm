import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoute } from "./router";

test("empty / root hash → enrollments list", () => {
  assert.deepEqual(parseRoute(""), { name: "enrollments" });
  assert.deepEqual(parseRoute("#/"), { name: "enrollments" });
});

test("course route", () => {
  assert.deepEqual(parseRoute("#/c/abc123"), { name: "course", eid: "abc123" });
});

test("onboarding + block routes", () => {
  assert.deepEqual(parseRoute("#/c/abc/onboarding"), { name: "onboarding", eid: "abc" });
  assert.deepEqual(parseRoute("#/c/abc/block/2"), { name: "block", eid: "abc", block: 2 });
});

test("session route with block + item", () => {
  assert.deepEqual(parseRoute("#/c/abc/session/3/3.1"), { name: "session", eid: "abc", block: 3, item: "3.1" });
});

test("quiz route (diagnostic/interblock/final only)", () => {
  assert.deepEqual(parseRoute("#/c/abc/quiz/diagnostic"), { name: "quiz", eid: "abc", kind: "diagnostic" });
  assert.deepEqual(parseRoute("#/c/abc/quiz/final"), { name: "quiz", eid: "abc", kind: "final" });
  assert.deepEqual(parseRoute("#/c/abc/quiz/bogus"), { name: "course", eid: "abc" }); // unknown kind → course
});

test("trailing slashes and url-encoding tolerated", () => {
  assert.deepEqual(parseRoute("#/c/ab%20c/"), { name: "course", eid: "ab c" });
});
