import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildF2fRubric, validateF2fRubric, decideF2fCertification, F2F_BAND_TABLE,
} from "./f2f-rubric.js";
import type { RubricCriterion } from "../content-model.js";

const domain4 = (): RubricCriterion[] => Array.from({ length: 4 }, (_, i) => ({
  label: `Compétence ${i + 1}`, competencyCode: `D1.C${i + 1}`, weightPoints: 15, minPoints: 8, origin: "annexe",
  bands: F2F_BAND_TABLE[15]!.ranges.map(([lo, hi], k) => ({ band: 4 - k, scoreRange: [lo, hi] as [number, number], descriptor: `bande ${4 - k}` })),
}));
const domain3 = (): RubricCriterion[] => Array.from({ length: 3 }, (_, i) => ({
  label: `Compétence ${i + 1}`, competencyCode: `D4.C${i + 1}`, weightPoints: 20, minPoints: 10, origin: "annexe",
  bands: F2F_BAND_TABLE[20]!.ranges.map(([lo, hi], k) => ({ band: 4 - k, scoreRange: [lo, hi] as [number, number], descriptor: `bande ${4 - k}` })),
}));

test("objet K.2 : le minimum coïncide avec le haut de la bande 2 sur les quatre pondérations", () => {
  for (const [w, t] of Object.entries(F2F_BAND_TABLE)) {
    const band2Top = t.ranges[2]![1];
    assert.equal(t.min, band2Top, `pondération ${w}`);
  }
});

test("configuration N1-N2 standard : S1 20/10 + S2 20, total 100, valide", () => {
  const r = buildF2fRubric(1, domain3());
  assert.equal(r.criteria.reduce((a, c) => a + c.weightPoints, 0), 100);
  const s1 = r.criteria.find((c) => c.label.startsWith("S1"))!;
  assert.equal(s1.weightPoints, 20); assert.equal(s1.minPoints, 10);
  assert.equal(s1.evidenceSource, "journal");
  assert.equal(r.criteria.some((c) => c.label.startsWith("S3")), false); // pas de S3 chez F2F
  assert.deepEqual(validateF2fRubric(r, 1), []);
});

test("configuration avec S5 : S5 15/8 + S1 15/8 + S2 10 — S5 est un livrable", () => {
  const r = buildF2fRubric(2, domain4(), { s5Enabled: true });
  assert.equal(r.criteria.reduce((a, c) => a + c.weightPoints, 0), 100);
  const s5 = r.criteria.find((c) => c.label.startsWith("S5"))!;
  assert.equal(s5.weightPoints, 15); assert.equal(s5.minPoints, 8);
  assert.equal(s5.evidenceSource, "livrable"); // vérification orale (objet B)
  assert.match(s5.bands![0]!.descriptor!, /deux contextes/); // exigence N2
  assert.deepEqual(validateF2fRubric(r, 2, { s5Enabled: true }), []);
});

test("configuration N3 : S4 15/8 + S1 10/5 + S2 15 ; S5 y est refusé", () => {
  const r = buildF2fRubric(3, domain4());
  const s4 = r.criteria.find((c) => c.label.startsWith("S4"))!;
  assert.equal(s4.evidenceSource, "livrable");
  const s1 = r.criteria.find((c) => c.label.startsWith("S1"))!;
  assert.equal(s1.weightPoints, 10); assert.equal(s1.minPoints, 5);
  assert.deepEqual(validateF2fRubric(r, 3), []);
  assert.throws(() => buildF2fRubric(3, domain4(), { s5Enabled: true }), /S4 le remplace/);
});

test("objet K.2 : des bandes v1.0 non réalignées (20 pts : 17-20…) sont refusées", () => {
  const r = buildF2fRubric(1, domain3());
  const c = r.criteria[0]!;
  c.bands = [[17, 20], [12, 16], [7, 11], [0, 6]].map(([lo, hi], k) => ({ band: 4 - k, scoreRange: [lo, hi] as [number, number], descriptor: "x" }));
  const issues = validateF2fRubric(r, 1);
  assert.ok(issues.some((i) => i.includes("objet K.2")));
});

test("objet C.2 : le plancher de démonstration bloque un domaine basculé vers l'écrit", () => {
  const dom = domain4().map((c, i) => ({ ...c, evidenceSource: (i < 3 ? "journal" : "situation") as const }));
  const issues = validateF2fRubric(buildF2fRubric(1, dom, { s5Enabled: true }), 1, { s5Enabled: true });
  assert.ok(issues.some((i) => i.includes("plancher de démonstration")));
});

test("§9 : un minimum manqué sur un critère de MISE EN SITUATION à 55-69 → reprise", () => {
  const r = buildF2fRubric(1, domain3());
  // domaine : 8 (sous le min 10), 16, 16 = 40 ; S1 12/10 ok ; S2 12 → total 64
  const d = decideF2fCertification(r.criteria, [{ points: 8 }, { points: 16 }, { points: 16 }, { points: 12 }, { points: 12 }], 70);
  assert.equal(d.decision, "RESUBMIT");
  assert.equal(d.natureBlocked, false);
});

test("§9 : la NATURE du critère l'emporte — minimum manqué sur S1 (journal) → non certifié même à 62", () => {
  const r = buildF2fRubric(1, domain3());
  // domaine 14+14+14 = 42 ; S1 8 (< 10, source journal) ; S2 12 → total 62
  const d = decideF2fCertification(r.criteria, [{ points: 14 }, { points: 14 }, { points: 14 }, { points: 8 }, { points: 12 }], 70);
  assert.equal(d.decision, "NOT_CERTIFIED");
  assert.equal(d.natureBlocked, true);
});

test("§9 : certifié à 70+ avec tous les minimums, quel que soit le reste", () => {
  const r = buildF2fRubric(1, domain3());
  const d = decideF2fCertification(r.criteria, [{ points: 16 }, { points: 15 }, { points: 14 }, { points: 14 }, { points: 14 }], 70);
  assert.equal(d.decision, "CERTIFIED");
  assert.equal(d.total, 73);
});
