import { test } from "node:test";
import assert from "node:assert/strict";
import { bandContiguityIssues, bandOf, decideCertification, nonCompensationCheck, type CriterionSpec } from "./certification.js";

// Grille socle+annexe N1 : 3 × 20 (min 10) + S1 15 (min 8) + S2 15 + S3 10.
const GRID: CriterionSpec[] = [
  { label: "C1", weightPoints: 20, minPoints: 10 },
  { label: "C2", weightPoints: 20, minPoints: 10 },
  { label: "C3", weightPoints: 20, minPoints: 10 },
  { label: "S1", weightPoints: 15, minPoints: 8 },
  { label: "S2", weightPoints: 15 },
  { label: "S3", weightPoints: 10 },
];
const score = (...pts: number[]) => pts.map((points) => ({ points }));

test("certifié : total ≥ 70 et tous les minimums atteints", () => {
  const r = decideCertification(GRID, score(18, 17, 17, 14, 13, 9)); // 88
  assert.equal(r.decision, "CERTIFIED");
  assert.equal(r.total, 88);
  assert.equal(r.allMinimumsMet, true);
});

test("certifié limite : 71 avec un minimum atteint tout juste", () => {
  const r = decideCertification(GRID, score(15, 14, 10, 12, 12, 8)); // 71, C3 = 10 = min
  assert.equal(r.decision, "CERTIFIED");
  assert.equal(r.total, 71);
});

test("remise : 55–69 avec un seul minimum manqué", () => {
  const r = decideCertification(GRID, score(14, 9, 14, 8, 12, 8)); // 65, C2 9 < 10
  assert.equal(r.decision, "RESUBMIT");
  assert.deepEqual(r.minimumsMissed.map((m) => m.label), ["C2"]);
});

test("remise : total ≥ 70 mais exactement un minimum manqué", () => {
  const r = decideCertification(GRID, score(9, 18, 18, 12, 13, 9)); // 79, C1 9 < 10
  assert.equal(r.decision, "RESUBMIT");
});

test("remise : 55–69 avec tous les minimums atteints", () => {
  const r = decideCertification(GRID, score(12, 12, 12, 9, 10, 8)); // 63
  assert.equal(r.decision, "RESUBMIT");
});

test("non certifié : la règle des minimums PRIME sur le total (62 pts, 2 minimums manqués)", () => {
  const r = decideCertification(GRID, score(9, 9, 18, 12, 9, 5)); // 62, C1 et C2 manqués
  assert.equal(r.decision, "NOT_CERTIFIED");
  assert.equal(r.minimumsMissed.length, 2);
});

test("non certifié : total < 55", () => {
  const r = decideCertification(GRID, score(7, 4, 6, 3, 3, 4)); // 27
  assert.equal(r.decision, "NOT_CERTIFIED");
});

test("frontières exactes : 55 = remise, 54 = non certifié ; 70 = certifié, 69 = remise", () => {
  assert.equal(decideCertification(GRID, score(11, 11, 11, 8, 9, 5)).decision, "RESUBMIT"); // 55
  assert.equal(decideCertification(GRID, score(11, 11, 11, 8, 9, 4)).decision, "NOT_CERTIFIED"); // 54
  assert.equal(decideCertification(GRID, score(14, 14, 14, 10, 10, 8)).decision, "CERTIFIED"); // 70
  assert.equal(decideCertification(GRID, score(14, 14, 14, 10, 10, 7)).decision, "RESUBMIT"); // 69
});

test("score hors pondération refusé", () => {
  assert.throws(() => decideCertification(GRID, score(25, 0, 0, 0, 0, 0)));
  assert.throws(() => decideCertification(GRID, score(-1, 0, 0, 0, 0, 0)));
});

test("bandOf retrouve la bande d'un score", () => {
  const c: CriterionSpec = { label: "C1", weightPoints: 20, bands: [
    { band: 4, scoreRange: [16, 20] }, { band: 3, scoreRange: [11, 15] },
    { band: 2, scoreRange: [6, 10] }, { band: 1, scoreRange: [0, 5] },
  ] };
  assert.equal(bandOf(c, 18), 4);
  assert.equal(bandOf(c, 10), 2);
  assert.equal(bandOf(c, 0), 1);
});

test("bandes contiguës validées ; trou et mauvaise couverture détectés", () => {
  const okBands: CriterionSpec = { label: "S1", weightPoints: 15, bands: [
    { band: 4, scoreRange: [13, 15] }, { band: 3, scoreRange: [9, 12] },
    { band: 2, scoreRange: [5, 8] }, { band: 1, scoreRange: [0, 4] },
  ] };
  assert.deepEqual(bandContiguityIssues(okBands), []);
  const gap: CriterionSpec = { label: "X", weightPoints: 20, bands: [
    { band: 4, scoreRange: [17, 20] }, { band: 3, scoreRange: [11, 15] },
    { band: 2, scoreRange: [6, 10] }, { band: 1, scoreRange: [0, 5] },
  ] };
  assert.ok(bandContiguityIssues(gap).length > 0);
});

test("non-compensation : 38 + 25 = 63 < 70 sur la grille N1", () => {
  const nc = nonCompensationCheck(GRID);
  assert.deepEqual(nc, { minimumsSum: 38, freeSum: 25, maxAtStrictMinimums: 63, ok: true });
});
