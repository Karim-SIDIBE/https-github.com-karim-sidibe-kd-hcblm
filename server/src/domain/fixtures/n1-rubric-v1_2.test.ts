import { test } from "node:test";
import assert from "node:assert/strict";
import { RubricSchema, type Rubric } from "../content-model.js";
import { bandContiguityIssues, nonCompensationCheck } from "../engine/certification.js";
import { n1Full } from "./n1-full.js";

// Annexe Gestion du Temps N1 v1.2 (remplace la v1.1) : les contrôles « avant
// publication » (§5), rejoués sur la grille portée par la fixture canonique.

const R = (n1Full as { blocks: { type: string; payload?: { rubric?: Rubric } }[] })
  .blocks.find((b) => b.type === "CERTIFICATION")!.payload!.rubric!;

test("annexe D4 v1.2 : la grille passe le schéma et totalise 100 points, seuil 70", () => {
  const parsed = RubricSchema.parse(R);
  assert.equal(parsed.criteria.reduce((a, c) => a + c.weightPoints, 0), 100);
  assert.equal(parsed.threshold, 70);
});

test("annexe D4 v1.2 : bloc domaine 60 pts à parts égales (4 × 15, min. 8) — D4.C4 réintégrée", () => {
  const domain = R.criteria.filter((c) => c.origin === "annexe");
  assert.equal(domain.length, 4);
  assert.deepEqual(domain.map((c) => c.competencyCode), ["D4.C1", "D4.C2", "D4.C3", "D4.C4"]);
  assert.equal(domain[3]!.label, "Performance durable et charge mentale");
  for (const c of domain) {
    assert.equal(c.weightPoints, 15);
    assert.equal(c.minPoints, 8); // « le minimum tombe au sommet de sa bande 2 » (6-8)
    assert.equal(c.bands?.length, 4);
  }
});

test("annexe D4 v1.2 : socle v1.1 — S1 15/min 8 (ne couvre PLUS D4.C4), S2 15, S3 10, dans l'ordre", () => {
  const [s1, s2, s3] = R.criteria.slice(4);
  assert.equal(s1!.label.startsWith("S1"), true);
  assert.equal(s1!.competencyCode, ""); // la correspondance D4.C4 → S1 de la v1.1 est levée
  assert.equal(s1!.weightPoints, 15); assert.equal(s1!.minPoints, 8);
  assert.equal(s2!.label.startsWith("S2"), true); assert.equal(s2!.weightPoints, 15); assert.equal(s2!.minPoints, undefined);
  assert.equal(s3!.label.startsWith("S3"), true); assert.equal(s3!.weightPoints, 10); assert.equal(s3!.minPoints, undefined);
});

test("annexe D4 v1.2 : bandes contiguës couvrant chaque pondération", () => {
  for (const c of R.criteria) assert.deepEqual(bandContiguityIssues(c), [], c.label);
});

test("annexe D4 v1.2 : non-compensation — 40 (minimums) + 25 (bloc libre) = 65 < 70", () => {
  const nc = nonCompensationCheck(R.criteria, R.threshold);
  assert.equal(nc.minimumsSum, 40);
  assert.equal(nc.freeSum, 25);
  assert.equal(nc.maxAtStrictMinimums, 65);
  assert.equal(nc.ok, true);
});

test("annexe D4 v1.2 : non-chevauchement §2.2 — D4.C4 lit les sections 2-3, jamais la section 4 (S1)", () => {
  const c4 = R.criteria.find((c) => c.competencyCode === "D4.C4")!;
  assert.match(c4.whereToLook ?? "", /Jamais la section 4/);
  const c3 = R.criteria.find((c) => c.competencyCode === "D4.C3")!;
  assert.match(c3.whereToLook ?? "", /journal de pratique pour les dates/);
});
