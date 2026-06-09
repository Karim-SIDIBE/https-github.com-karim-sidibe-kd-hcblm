import { test } from "node:test";
import assert from "node:assert/strict";
import { blockUnitCounts, courseUnitTotals } from "./content-model.js";

test("blockUnitCounts keeps the three unit types strictly separate", () => {
  const c = blockUnitCounts([{ type: "micro-session" }, { type: "micro-session" }, { type: "long-activity" }, { type: "micro-task" }]);
  assert.deepEqual(c, { microSessions: 2, longActivities: 1, microTasks: 1 });
});

test("blockUnitCounts is empty for undefined/empty", () => {
  assert.deepEqual(blockUnitCounts(), { microSessions: 0, longActivities: 0, microTasks: 0 });
  assert.deepEqual(blockUnitCounts([]), { microSessions: 0, longActivities: 0, microTasks: 0 });
});

test("courseUnitTotals sums per type and never mixes them (auditable)", () => {
  const totals = courseUnitTotals([
    { units: [{ type: "micro-session" }, { type: "long-activity" }] },
    { units: [{ type: "micro-session" }, { type: "micro-task" }] },
    { units: undefined },
  ]);
  assert.deepEqual(totals, { microSessions: 2, longActivities: 1, microTasks: 1 });
});
