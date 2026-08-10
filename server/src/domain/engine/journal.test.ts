import { test } from "node:test";
import assert from "node:assert/strict";
import { journalRecap } from "./journal.js";

const DAYS = [2, 4, 6, 9, 11, 15].map((day) => ({ day }));
const at = (key: string, iso: string) => ({ itemKey: key, completedAt: new Date(iso) });

test("journal étalé : décompte complet, aucun rattrapage groupé", () => {
  const r = journalRecap(DAYS, [
    at("J+2", "2026-06-16T18:00:00Z"), at("J+4", "2026-06-18T18:00:00Z"), at("J+6", "2026-06-20T18:00:00Z"),
    at("J+9", "2026-06-23T18:00:00Z"), at("J+11", "2026-06-25T18:00:00Z"), at("J+15", "2026-06-29T18:00:00Z"),
  ]);
  assert.equal(r.expected, 6);
  assert.equal(r.completed, 6);
  assert.equal(r.groupedCatchup, false);
});

test("plus de deux entrées le même jour = rattrapage groupé (bande 4 du S1 exclue)", () => {
  const r = journalRecap(DAYS, [
    at("J+2", "2026-06-30T09:00:00Z"), at("J+4", "2026-06-30T09:05:00Z"), at("J+6", "2026-06-30T09:10:00Z"),
    at("J+9", "2026-06-30T09:15:00Z"), at("J+11", "2026-06-30T09:20:00Z"), at("J+15", "2026-06-30T09:25:00Z"),
  ]);
  assert.equal(r.completed, 6);
  assert.equal(r.groupedCatchup, true);
});

test("deux entrées le même jour restent tolérées (« plus de deux »)", () => {
  const r = journalRecap(DAYS, [
    at("J+2", "2026-06-16T18:00:00Z"), at("J+4", "2026-06-18T18:00:00Z"),
    at("J+6", "2026-06-20T08:00:00Z"), at("J+9", "2026-06-20T21:00:00Z"),
  ]);
  assert.equal(r.completed, 4);
  assert.equal(r.groupedCatchup, false);
  assert.equal(r.entries.find((e) => e.day === 15)?.completedAt, null);
});

test("journal incomplet : le décompte reflète les entrées manquantes", () => {
  const r = journalRecap(DAYS, [at("J+2", "2026-06-16T18:00:00Z")]);
  assert.equal(r.expected, 6);
  assert.equal(r.completed, 1);
});
