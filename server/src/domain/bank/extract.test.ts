import { test } from "node:test";
import assert from "node:assert/strict";
import { extractScoredQuestions } from "./extract.js";
import { n1Full } from "../fixtures/n1-full.js";

test("extractScoredQuestions harvests every scored question of the N1 course", () => {
  const items = extractScoredQuestions(n1Full as never);
  // 10 diagnostic + 6 inter-block + 8 final = the canonical course's 24.
  assert.equal(items.filter((i) => i.quiz === "diagnostic").length, 10);
  assert.equal(items.filter((i) => i.quiz === "interblock").length, 6);
  assert.equal(items.filter((i) => i.quiz === "final").length, 8);
  assert.equal(items.length, 24);
  // Stable, unique provenance keys.
  assert.equal(new Set(items.map((i) => i.key)).size, 24);
  for (const i of items) {
    assert.ok(i.key.startsWith(`${i.quiz}:`));
    assert.ok(i.question.scenarioText.length > 0);
    assert.ok(i.question.feedbackText.length > 0);
  }
});

test("extractScoredQuestions is defensive on malformed content", () => {
  assert.deepEqual(extractScoredQuestions(null), []);
  assert.deepEqual(extractScoredQuestions({}), []);
  assert.deepEqual(extractScoredQuestions({ blocks: [{ payload: null }, {}] }), []);
});
