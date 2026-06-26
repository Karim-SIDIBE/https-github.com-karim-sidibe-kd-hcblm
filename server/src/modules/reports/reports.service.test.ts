import { test } from "node:test";
import assert from "node:assert/strict";
import { isDue } from "./reports.service.js";

const at = (iso: string) => new Date(iso);

test("isDue: never sent → always due", () => {
  assert.equal(isDue({ frequency: "WEEKLY", lastSentAt: null }, at("2026-06-26T00:00:00Z")), true);
  assert.equal(isDue({ frequency: "MONTHLY", lastSentAt: null }, at("2026-06-26T00:00:00Z")), true);
});

test("isDue: weekly fires at 7 days, not before", () => {
  const sent = at("2026-06-01T00:00:00Z");
  assert.equal(isDue({ frequency: "WEEKLY", lastSentAt: sent }, at("2026-06-07T12:00:00Z")), false); // <7d
  assert.equal(isDue({ frequency: "WEEKLY", lastSentAt: sent }, at("2026-06-08T00:00:00Z")), true);  // ≥7d
});

test("isDue: monthly fires at 30 days, not before", () => {
  const sent = at("2026-06-01T00:00:00Z");
  assert.equal(isDue({ frequency: "MONTHLY", lastSentAt: sent }, at("2026-06-20T00:00:00Z")), false); // <30d
  assert.equal(isDue({ frequency: "MONTHLY", lastSentAt: sent }, at("2026-07-02T00:00:00Z")), true);  // ≥30d
});
