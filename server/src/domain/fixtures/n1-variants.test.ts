import { test } from "node:test";
import assert from "node:assert/strict";
import { ScoredQuestion } from "../content-model.js";
import { n1Variants } from "./n1-variants.js";
import { extractScoredQuestions } from "../bank/extract.js";
import { n1Full } from "./n1-full.js";

test("n1Variants: 4 variants per original question, all schema-valid", () => {
  assert.equal(n1Variants.length, 96);
  // Every variant parses as a ScoredQuestion (runtime double-check of the types).
  for (const v of n1Variants) {
    const parsed = ScoredQuestion.safeParse(v.question);
    assert.ok(parsed.success, `variante ${v.question.id} invalide: ${JSON.stringify(!parsed.success && parsed.error.issues[0])}`);
    assert.ok(v.angle.length > 0);
    assert.ok(v.subArea.length > 0);
  }
  // Exactly 4 per original course question, and each variantOf exists.
  const originals = new Set(extractScoredQuestions(n1Full as never).map((i) => i.key));
  const byOriginal = new Map<string, number>();
  for (const v of n1Variants) {
    assert.ok(originals.has(v.variantOf), `variantOf inconnu: ${v.variantOf}`);
    byOriginal.set(v.variantOf, (byOriginal.get(v.variantOf) ?? 0) + 1);
  }
  assert.equal(byOriginal.size, 24);
  for (const [k, n] of byOriginal) assert.equal(n, 4, `${k} a ${n} variantes`);
  // Unique ids + 4 distinct angles within each original (anti-redundancy).
  assert.equal(new Set(n1Variants.map((v) => v.question.id)).size, 96);
  for (const key of byOriginal.keys()) {
    const angles = n1Variants.filter((v) => v.variantOf === key).map((v) => v.angle);
    assert.equal(new Set(angles).size, 4, `angles non distincts pour ${key}`);
  }
});
