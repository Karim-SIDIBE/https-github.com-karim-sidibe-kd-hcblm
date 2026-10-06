import { test } from "node:test";
import assert from "node:assert/strict";
import { RubricSchema } from "../content-model.js";
import { bandContiguityIssues, nonCompensationCheck } from "../engine/certification.js";
import { annexeCommunicationN1Rubric as R } from "./annexe-communication-n1.js";

// Grille officielle de l'Annexe Communication professionnelle N1 v1.0 :
// les contrôles « avant publication » de l'annexe (§4), rejoués en test.

test("annexe D1 N1 : la grille passe le schéma et totalise 100 points", () => {
  const parsed = RubricSchema.parse(R);
  assert.equal(parsed.criteria.reduce((a, c) => a + c.weightPoints, 0), 100);
  assert.equal(parsed.threshold, 70); // seuil N1
});

test("annexe D1 N1 : bloc domaine 60 pts à parts égales (4 × 15), minima à 8 (50 % arrondi sup.)", () => {
  const domain = R.criteria.filter((c) => c.origin === "annexe");
  assert.equal(domain.length, 4);
  assert.deepEqual(domain.map((c) => c.competencyCode), ["D1.C1", "D1.C2", "D1.C3", "D1.C4"]);
  for (const c of domain) {
    assert.equal(c.weightPoints, 15);
    assert.equal(c.minPoints, 8); // « le minimum tombe au sommet de sa bande 2 » (6-8)
    assert.equal(c.bands?.length, 4);
  }
});

test("annexe D1 N1 : socle v1.1 — S1 15/min 8, S2 15, S3 10, dans l'ordre après le domaine", () => {
  const labels = R.criteria.map((c) => c.label);
  assert.equal(labels[4]?.startsWith("S1"), true);
  assert.equal(labels[5]?.startsWith("S2"), true);
  assert.equal(labels[6]?.startsWith("S3"), true);
  const [s1, s2, s3] = R.criteria.slice(4);
  assert.equal(s1!.weightPoints, 15); assert.equal(s1!.minPoints, 8);
  assert.equal(s2!.weightPoints, 15); assert.equal(s2!.minPoints, undefined);
  assert.equal(s3!.weightPoints, 10); assert.equal(s3!.minPoints, undefined);
});

test("annexe D1 N1 : les bandes de chaque critère sont contiguës et couvrent la pondération", () => {
  for (const c of R.criteria) {
    assert.deepEqual(bandContiguityIssues(c), [], c.label);
  }
});

test("annexe D1 N1 : non-compensation — 40 (minimums) + 25 (bloc libre) = 65, sous le seuil de 70", () => {
  const nc = nonCompensationCheck(R.criteria, R.threshold);
  assert.equal(nc.minimumsSum, 40);
  assert.equal(nc.freeSum, 25);
  assert.equal(nc.maxAtStrictMinimums, 65);
  assert.equal(nc.ok, true);
});

test("annexe D1 N1 : non-chevauchement §2.2 — S1 lit la régularité du journal, D1.C4 le contenu de J+2/J+6/J+11", () => {
  const c4 = R.criteria.find((c) => c.competencyCode === "D1.C4")!;
  assert.match(c4.whereToLook ?? "", /J\+2, J\+6 et J\+11/);
  const s1 = R.criteria.find((c) => c.label.startsWith("S1"))!;
  assert.match(s1.whereToLook ?? "", /6 micro-entrées/);
});
