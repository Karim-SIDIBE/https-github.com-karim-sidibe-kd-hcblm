import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, remainingSeconds, remainingLabel } from "./format";

test("formatDuration renders seconds/minutes/hours", () => {
  assert.equal(formatDuration(0), "—");
  assert.equal(formatDuration(45), "45 s");
  assert.equal(formatDuration(240), "4 min");
  assert.equal(formatDuration(3600), "1 h");
  assert.equal(formatDuration(3900), "1 h 05");
});

test("remainingSeconds sums only incomplete sessions", () => {
  const s = [
    { key: "1.1", durationSec: 240, done: true },
    { key: "1.2", durationSec: 300, done: false },
    { key: "1.3", durationSec: 180, done: false },
  ];
  assert.equal(remainingSeconds(s), 480);
  assert.equal(remainingLabel(s), "Il reste 8 min");
});

test("remainingLabel is null when everything is done", () => {
  assert.equal(remainingLabel([{ key: "a", durationSec: 120, done: true }]), null);
});
