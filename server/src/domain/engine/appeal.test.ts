import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessDays, appealWindowOpen, qcSummary, resolveAppeal, shouldDoubleMark,
} from "./appeal.js";

test("étape 1 : fenêtre de 15 jours calendaires, bornes incluses", () => {
  const decided = new Date("2026-08-01T10:00:00Z");
  assert.equal(appealWindowOpen(decided, new Date("2026-08-01T10:00:00Z")), true);
  assert.equal(appealWindowOpen(decided, new Date("2026-08-16T10:00:00Z")), true);   // J+15
  assert.equal(appealWindowOpen(decided, new Date("2026-08-16T10:00:01Z")), false);  // J+15 dépassé
  assert.equal(appealWindowOpen(decided, new Date("2026-07-31T10:00:00Z")), false);  // avant la décision
});

test("jours ouvrables : les week-ends ne comptent pas", () => {
  // Vendredi 7 août 2026 + 5 j ouvrables = vendredi 14 août.
  assert.equal(addBusinessDays(new Date("2026-08-07T09:00:00Z"), 5).toISOString().slice(0, 10), "2026-08-14");
  // Vendredi + 1 j ouvrable = lundi.
  assert.equal(addBusinessDays(new Date("2026-08-07T09:00:00Z"), 1).toISOString().slice(0, 10), "2026-08-10");
});

test("étape 4 : écart < 10 → la moyenne par critère fait foi (arrondie)", () => {
  const r = resolveAppeal([15, 14, 12, 12, 12, 8], [14, 12, 11, 11, 11, 7]); // 73 vs 66, écart 7
  assert.equal(r.gap, 7);
  assert.equal(r.needsThird, false);
  assert.deepEqual(r.averagedScores, [15, 13, 12, 12, 12, 8]); // arrondi au plus proche (x.5 → sup)
});

test("étape 4 : écart ≥ 10 → un troisième évaluateur tranche", () => {
  const r = resolveAppeal([15, 14, 12, 12, 12, 8], [10, 10, 10, 10, 10, 6]); // 73 vs 56, écart 17
  assert.equal(r.needsThird, true);
  assert.equal(r.averagedScores, null);
  // Cas limite : écart exactement 10 → troisième évaluateur aussi.
  assert.equal(resolveAppeal([20, 20, 20, 13, 13, 9], [20, 20, 20, 13, 13, 9].map((x, i) => i === 0 ? 10 : x)).needsThird, true);
});

test("notations désalignées : erreur explicite", () => {
  assert.throws(() => resolveAppeal([10, 10], [10, 10, 10]));
});

test("§9.3 : un dossier noté sur dix part en double notation", () => {
  assert.equal(shouldDoubleMark(10), true);
  assert.equal(shouldDoubleMark(20), true);
  assert.equal(shouldDoubleMark(9), false);
  assert.equal(shouldDoubleMark(1), false);
  assert.equal(shouldDoubleMark(0), false);
});

test("§9.3 : médiane des écarts et alertes", () => {
  const calm = qcSummary([2, 4, 6, 3, 5]);
  assert.equal(calm.medianGap, 4);
  assert.equal(calm.medianAlert, false);
  assert.equal(calm.incidents, 0);

  const hot = qcSummary([9, 12, 7, 16, 10]); // médiane 10 > 8 ; un écart 16 > 15
  assert.equal(hot.medianGap, 10);
  assert.equal(hot.medianAlert, true);
  assert.equal(hot.incidents, 1);

  const empty = qcSummary([]);
  assert.equal(empty.medianGap, null);
  assert.equal(empty.medianAlert, false);

  const even = qcSummary([4, 8]); // médiane paire = 6
  assert.equal(even.medianGap, 6);
});
