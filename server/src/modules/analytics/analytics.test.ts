import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./analytics.service.js";

test("toCsv emits a header row + data rows", () => {
  const csv = toCsv([{ name: "Awa", status: "CERTIFIED", score: 85 }, { name: "Koffi", status: "ACTIVE", score: null }]);
  const lines = csv.split("\n");
  assert.equal(lines[0], "name,status,score");
  assert.equal(lines[1], "Awa,CERTIFIED,85");
  assert.equal(lines[2], "Koffi,ACTIVE,"); // null → empty
});

test("toCsv escapes commas, quotes and newlines", () => {
  const csv = toCsv([{ name: 'Diallo, "A"', note: "ligne1\nligne2" }]);
  // The embedded newline lives inside a quoted field, so compare the whole string.
  assert.equal(csv, 'name,note\n"Diallo, ""A""","ligne1\nligne2"');
});

test("toCsv on empty input is empty", () => {
  assert.equal(toCsv([]), "");
});
