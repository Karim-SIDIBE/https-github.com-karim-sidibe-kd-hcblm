import { test } from "node:test";
import assert from "node:assert/strict";
import { F2F_SHAPE, certificationPrereqs, convocationStage, entriesPerPeriod, f2fShape, journalNudgeDue } from "./f2f.js";

test("formes K-SPEM v2.0 : 3/2/6 · 4/3/9 · 5/4/12", () => {
  assert.deepEqual(F2F_SHAPE[1], { sessions: 3, periods: 2, journalMin: 6, label: "Fondamentaux" });
  assert.deepEqual(F2F_SHAPE[2], { sessions: 4, periods: 3, journalMin: 9, label: "Avancé" });
  assert.deepEqual(F2F_SHAPE[3], { sessions: 5, periods: 4, journalMin: 12, label: "Expert" });
  assert.throws(() => f2fShape(4), /invalide/);
});

const complete = (level: 1 | 2 | 3) => {
  const n = F2F_SHAPE[level].sessions;
  return {
    level,
    sessions: Array.from({ length: n }, (_, i) => ({ index: i + 1, held: true })),
    presentAt: Array.from({ length: n }, (_, i) => i + 1),
    journalCount: F2F_SHAPE[level].journalMin,
    missionAt: Array.from({ length: n - 1 }, (_, i) => i + 1),
    hasAnchor: true,
  };
};

test("verrou §6 : dossier complet N2 → toutes conditions vertes", () => {
  const v = certificationPrereqs(complete(2));
  assert.equal(v.ok, true);
  assert.deepEqual(v.prereqs.map((p) => p.ok), [true, true, true, true]);
});

test("verrou §6 : une absence bloque, même avec tout le reste", () => {
  const input = complete(2);
  input.presentAt = [1, 3, 4]; // absent Session 2
  const v = certificationPrereqs(input);
  assert.equal(v.ok, false);
  assert.equal(v.prereqs.find((p) => p.code === "presence")!.ok, false);
});

test("verrou §6 : session non TENUE = présence impossible, même marqué présent", () => {
  const input = complete(1);
  input.sessions[2] = { index: 3, held: false };
  const v = certificationPrereqs(input);
  assert.equal(v.prereqs.find((p) => p.code === "presence")!.ok, false);
});

test("verrou §6 : journal sous le minimum du niveau (9 exigées en N2 V2.0)", () => {
  const input = complete(2);
  input.journalCount = 8;
  const v = certificationPrereqs(input);
  assert.equal(v.prereqs.find((p) => p.code === "journal")!.ok, false);
});

test("verrou §6 : mission manquante après une session intermédiaire", () => {
  const input = complete(3);
  input.missionAt = [1, 2, 4]; // manque après la Session 3
  const v = certificationPrereqs(input);
  assert.equal(v.prereqs.find((p) => p.code === "missions")!.ok, false);
});

test("verrou §6 : fiche d'ancrage absente", () => {
  const input = complete(1);
  input.hasAnchor = false;
  const v = certificationPrereqs(input);
  assert.equal(v.ok, false);
  assert.equal(v.prereqs.find((p) => p.code === "anchor")!.ok, false);
});

const DAY = 864e5;

test("convocations : rien avant J-7, convocation à J-7, rappel à J-1, plus rien après", () => {
  const at = new Date("2026-10-10T09:00:00Z");
  assert.equal(convocationStage(at, new Date(at.getTime() - 8 * DAY)), 0);
  assert.equal(convocationStage(at, new Date(at.getTime() - 7 * DAY + 3600e3)), 1);
  assert.equal(convocationStage(at, new Date(at.getTime() - 2 * DAY)), 1);
  assert.equal(convocationStage(at, new Date(at.getTime() - 12 * 3600e3)), 2);
  assert.equal(convocationStage(at, new Date(at.getTime() + 3600e3)), 0);
});

test("rythme du journal : 3 entrées attendues par période à chaque niveau (V2.0)", () => {
  assert.equal(entriesPerPeriod(1), 3);
  assert.equal(entriesPerPeriod(2), 3);
  assert.equal(entriesPerPeriod(3), 3);
});

test("relance mi-période : due sous 2 entrées après la moitié, jamais avant ni au rythme", () => {
  const start = new Date("2026-10-01T00:00:00Z");
  const end = new Date("2026-10-29T00:00:00Z"); // 4 semaines
  const before = new Date("2026-10-10T00:00:00Z"); // avant la mi-période (15/10)
  const after = new Date("2026-10-20T00:00:00Z");
  assert.equal(journalNudgeDue({ periodStart: start, periodEnd: end, now: before, entries: 0 }), false);
  assert.equal(journalNudgeDue({ periodStart: start, periodEnd: end, now: after, entries: 0 }), true);
  assert.equal(journalNudgeDue({ periodStart: start, periodEnd: end, now: after, entries: 1 }), true);
  assert.equal(journalNudgeDue({ periodStart: start, periodEnd: end, now: after, entries: 2 }), false);
  assert.equal(journalNudgeDue({ periodStart: start, periodEnd: end, now: new Date(end.getTime() + DAY), entries: 0 }), false);
});
