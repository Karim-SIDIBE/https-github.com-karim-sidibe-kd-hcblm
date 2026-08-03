import { test } from "node:test";
import assert from "node:assert/strict";
import { GRANULAR_VERBS, isGranularVerb, retentionCutoff, toNdjsonLine } from "./retention.js";
import { VERBS } from "../../domain/engine/xapi.js";

test("granular verbs are exactly answered/progressed/experienced — milestones stay", () => {
  // XapiStatement.verb stores the short VerbKey (e.g. "answered"), not the IRI.
  assert.ok(isGranularVerb("answered"));
  assert.ok(isGranularVerb("progressed"));
  assert.ok(isGranularVerb("experienced"));
  for (const milestone of ["completed", "passed", "failed", "earned", "registered", "attended", "initialized"] as const) {
    assert.ok(!isGranularVerb(milestone), `${milestone} ne doit jamais être purgé`);
    assert.ok(VERBS[milestone], `${milestone} est bien un verbe du vocabulaire`);
  }
  assert.equal(GRANULAR_VERBS.length, 3);
});

test("retentionCutoff subtracts calendar months", () => {
  const cutoff = retentionCutoff(new Date("2026-08-03T12:00:00Z"), 12);
  assert.equal(cutoff.toISOString(), "2025-08-03T12:00:00.000Z");
});

test("toNdjsonLine is one parseable JSON object per statement, ids preserved", () => {
  const line = toNdjsonLine({
    id: "x1", enrollmentId: "e1", verb: VERBS.answered.id,
    objectId: "https://ex/xapi/courses/c/blocks/1/items/diagnostic/questions/d1",
    statement: { actor: { name: "A" }, result: { success: true } },
    storedAt: new Date("2025-01-15T10:00:00Z"),
  });
  assert.ok(!line.includes("\n"));
  const parsed = JSON.parse(line);
  assert.equal(parsed.id, "x1");
  assert.equal(parsed.storedAt, "2025-01-15T10:00:00.000Z");
  assert.equal(parsed.statement.result.success, true);
});
