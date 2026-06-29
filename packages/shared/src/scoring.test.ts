import { test } from "node:test";
import assert from "node:assert/strict";
import { isAnswerCorrect } from "./scoring.js";

test("single MCQ (and untyped legacy questions)", () => {
  const q = { type: "single" as const, correctKey: "B" };
  assert.equal(isAnswerCorrect(q, "B"), true);
  assert.equal(isAnswerCorrect(q, "A"), false);
  assert.equal(isAnswerCorrect(q, ""), false);
  assert.equal(isAnswerCorrect({ correctKey: "B" }, "B"), true); // no type → single
});

test("multiple-select requires the exact set", () => {
  const q = { type: "multiple" as const, correctKeys: ["A", "C"] };
  assert.equal(isAnswerCorrect(q, "A,C"), true);
  assert.equal(isAnswerCorrect(q, "C,A"), true);   // order-insensitive
  assert.equal(isAnswerCorrect(q, "A"), false);     // missing one
  assert.equal(isAnswerCorrect(q, "A,B,C"), false); // extra one
  assert.equal(isAnswerCorrect(q, ""), false);
});

test("true / false", () => {
  assert.equal(isAnswerCorrect({ type: "truefalse", correctBool: true }, "true"), true);
  assert.equal(isAnswerCorrect({ type: "truefalse", correctBool: true }, "false"), false);
  assert.equal(isAnswerCorrect({ type: "truefalse", correctBool: false }, "false"), true);
  assert.equal(isAnswerCorrect({ type: "truefalse", correctBool: true }, ""), false);
});

test("numeric with optional tolerance + comma decimals", () => {
  assert.equal(isAnswerCorrect({ type: "numeric", answerNumber: 42 }, "42"), true);
  assert.equal(isAnswerCorrect({ type: "numeric", answerNumber: 42 }, "43"), false);
  assert.equal(isAnswerCorrect({ type: "numeric", answerNumber: 42, tolerance: 1 }, "43"), true);
  assert.equal(isAnswerCorrect({ type: "numeric", answerNumber: 42 }, "42,0"), true);
  assert.equal(isAnswerCorrect({ type: "numeric", answerNumber: 42 }, "abc"), false);
});

test("short answer is case/accent/space-insensitive against accepted list", () => {
  const q = { type: "short" as const, accepted: ["délégation", "déléguer"] };
  assert.equal(isAnswerCorrect(q, "délégation"), true);
  assert.equal(isAnswerCorrect(q, "DELEGATION"), true);
  assert.equal(isAnswerCorrect(q, "  delegation "), true);
  assert.equal(isAnswerCorrect(q, "Déléguer"), true);
  assert.equal(isAnswerCorrect(q, "autre"), false);
  assert.equal(isAnswerCorrect(q, ""), false);
});
