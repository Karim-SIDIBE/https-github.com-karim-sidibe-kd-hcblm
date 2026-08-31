import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkCalibration, evidenceCopied, isLowBand, normalizeWhitespace,
  sharesConsecutiveWords, verifyCitation, verifyEvidence,
  type CalibrationRun, type ComplianceCriterion, type SuggestedCriterion,
} from "./ai-compliance.js";

const DOSSIER = [
  "Semaine 1. J'ai planifié mes trois priorités du jour chaque matin avant l'ouverture du marché.",
  "J'ai noté que les interruptions familiales tombaient surtout entre midi et quatorze heures.",
  "Semaine 4 : le carnet montre une pratique tenue vingt-deux jours sur trente, y compris pendant la coupure d'électricité.",
].join("\n");

// Critère annexe (20 pts, bandes 4→1) + critère socle S3 (10 pts) avec whereToLook.
const C20: ComplianceCriterion = {
  label: "Organisation personnelle", weightPoints: 20, minPoints: 10,
  bands: [
    { band: 4, scoreRange: [17, 20] }, { band: 3, scoreRange: [12, 16] },
    { band: 2, scoreRange: [6, 11] }, { band: 1, scoreRange: [0, 5] },
  ],
  whereToLook: "Sections 1 et 2 du projet : méthode de planification et priorités nommées",
};
const S3: ComplianceCriterion = {
  label: "S3 — Ancrage", weightPoints: 10,
  bands: [
    { band: 4, scoreRange: [9, 10] }, { band: 3, scoreRange: [6, 8] },
    { band: 2, scoreRange: [3, 5] }, { band: 1, scoreRange: [0, 2] },
  ],
  whereToLook: "Section 4 et journal : contraintes du contexte réel intégrées à la pratique",
};

test("normalisation des espaces : blancs multiples, tabulations et sauts de ligne", () => {
  assert.equal(normalizeWhitespace("  a\t b\n\nc  "), "a b c");
});

test("citation §8.4 : la typographie (apostrophes, guillemets) ne fait pas échouer une citation honnête", () => {
  // Le dossier vient d'un traitement de texte (’) ; le modèle écrit droit (').
  const dossier = "La difficulté principale a été de faire accepter l’heure fixe aux anciens chauffeurs, habitués à passer quand ils veulent.";
  assert.equal(verifyCitation("faire accepter l'heure fixe aux anciens chauffeurs, habitués à passer", dossier), null);
  // La réciproque aussi (dossier droit, citation typographique).
  assert.equal(verifyCitation("faire accepter l’heure fixe aux anciens chauffeurs, habitués à passer", dossier.replace(/’/g, "'")), null);
  // La casse d'un début de citation en milieu de phrase ne compte pas non plus…
  assert.equal(verifyCitation("la difficulté principale a été de faire accepter l'heure fixe", dossier), null);
  // …ni les tirets typographiques.
  assert.equal(verifyCitation("habitués à passer quand ils veulent - le respect du contact", "habitués à passer quand ils veulent — le respect du contact personnel"), null);
  // …mais une citation reformulée reste refusée : l'exigence ne bouge pas.
  assert.equal(verifyCitation("accepter une heure fixe aux nouveaux chauffeurs habitués à passer souvent", dossier), "not_found");
});

test("citation valide : ≥ 8 mots consécutifs retrouvés malgré des espaces différents", () => {
  const extract = "J'ai   planifié mes trois priorités du jour\nchaque matin";
  assert.equal(verifyCitation(extract, DOSSIER), null);
});

test("citation refusée : moins de 8 mots", () => {
  assert.equal(verifyCitation("planifié mes trois priorités du jour", DOSSIER), "too_short");
});

test("citation refusée : ellipse interne", () => {
  assert.equal(verifyCitation("J'ai planifié mes trois priorités … avant l'ouverture du marché", DOSSIER), "ellipsis");
});

test("citation refusée : introuvable dans le livrable (comparaison exacte)", () => {
  assert.equal(verifyCitation("J'ai planifié mes quatre priorités du jour chaque matin", DOSSIER), "not_found");
});

test("bande basse : bandes 1-2 déclarées, sinon moitié de la pondération", () => {
  assert.equal(isLowBand(C20, 11), true);   // bande 2
  assert.equal(isLowBand(C20, 12), false);  // bande 3
  assert.equal(isLowBand({ label: "X", weightPoints: 10 }, 4), true);
  assert.equal(isLowBand({ label: "X", weightPoints: 10 }, 5), false);
});

test("reprise de « Où chercher la preuve » : 4 mots consécutifs partagés", () => {
  assert.equal(sharesConsecutiveWords(
    "Aucune méthode de planification et priorités nommées dans les sections parcourues.",
    C20.whereToLook!, 4,
  ), true);
  assert.equal(sharesConsecutiveWords("Rien trouvé nulle part.", C20.whereToLook!, 4), false);
});

test("verdict : citations vérifiées sur les deux critères → suggestion admissible", () => {
  const suggestions: SuggestedCriterion[] = [
    { label: C20.label, suggested: 15, citations: ["J'ai planifié mes trois priorités du jour chaque matin avant l'ouverture du marché."] },
    { label: S3.label, suggested: 7, citations: ["y compris pendant la coupure d'électricité", "le carnet montre une pratique tenue vingt-deux jours sur trente"] },
  ];
  // 1re citation S3 trop courte → la corriger pour la rendre valide.
  suggestions[1]!.citations = ["le carnet montre une pratique tenue vingt-deux jours sur trente, y compris pendant la coupure d'électricité."];
  const v = verifyEvidence([C20, S3], suggestions, DOSSIER);
  assert.equal(v.ok, true);
  assert.deepEqual(v.perCriterion.map((c) => c.ok), [true, true]);
});

test("tout-ou-rien §8.5 : un critère en échec bloque l'ensemble", () => {
  const v = verifyEvidence([C20, S3], [
    { label: C20.label, suggested: 15, citations: ["J'ai planifié mes trois priorités du jour chaque matin avant l'ouverture du marché."] },
    { label: S3.label, suggested: 7, citations: ["une phrase inventée qui ne figure pas dans le livrable soumis"] },
  ], DOSSIER);
  assert.equal(v.ok, false);
  assert.equal(v.perCriterion[0]!.ok, true);
  assert.deepEqual(v.perCriterion[1]!.issues, ["citation:not_found"]);
});

test("déclaration d'absence : admise en bande basse quand elle reprend whereToLook", () => {
  const v = verifyEvidence([C20], [
    { label: C20.label, suggested: 8, absence: "Aucune méthode de planification et priorités nommées dans les sections 1 et 2." },
  ], DOSSIER);
  assert.equal(v.ok, true);
});

test("déclaration d'absence refusée : bande haute, ou ligne whereToLook non reprise", () => {
  const high = verifyEvidence([C20], [{ label: C20.label, suggested: 15, absence: "Aucune méthode de planification et priorités nommées." }], DOSSIER);
  assert.deepEqual(high.perCriterion[0]!.issues, ["absence:not_low_band"]);
  const vague = verifyEvidence([C20], [{ label: C20.label, suggested: 8, absence: "Rien de probant dans le dossier." }], DOSSIER);
  assert.deepEqual(vague.perCriterion[0]!.issues, ["absence:where_to_look_missing"]);
});

test("déclaration d'absence : ligne « Où chercher » courte (< 4 mots) reprise en entier", () => {
  const short: ComplianceCriterion = { ...S3, whereToLook: "L'ensemble du dossier" };
  const okAbs = verifyEvidence([short], [{ label: short.label, suggested: 4, absence: "Rien relevé dans l'ensemble du dossier concernant l'ancrage." }], DOSSIER);
  assert.equal(okAbs.ok, true);
  const koAbs = verifyEvidence([short], [{ label: short.label, suggested: 4, absence: "Rien relevé nulle part." }], DOSSIER);
  assert.deepEqual(koAbs.perCriterion[0]!.issues, ["absence:where_to_look_missing"]);
});

test("ni citation ni absence, ou les deux à la fois, ou > 3 extraits : refus", () => {
  const none = verifyEvidence([C20], [{ label: C20.label, suggested: 10 }], DOSSIER);
  assert.deepEqual(none.perCriterion[0]!.issues, ["no_evidence"]);
  const both = verifyEvidence([C20], [{ label: C20.label, suggested: 8, citations: ["J'ai planifié mes trois priorités du jour chaque matin avant l'ouverture du marché."], absence: "Aucune méthode de planification et priorités nommées ici." }], DOSSIER);
  assert.equal(both.perCriterion[0]!.issues.includes("both_forms"), true);
  const four = verifyEvidence([C20], [{
    label: C20.label, suggested: 15,
    citations: Array(4).fill("J'ai planifié mes trois priorités du jour chaque matin avant l'ouverture du marché."),
  }], DOSSIER);
  assert.equal(four.perCriterion[0]!.issues.includes("too_many_extracts"), true);
});

test("indicateur de copie : reprise à l'identique d'une preuve IA (espaces ignorés)", () => {
  const s: SuggestedCriterion = { label: "C", suggested: 12, citations: ["le carnet montre une pratique tenue vingt-deux jours sur trente"] };
  assert.equal(evidenceCopied("le carnet  montre une pratique\ntenue vingt-deux jours sur trente", s), true);
  assert.equal(evidenceCopied("Ma propre lecture du carnet sur trente jours", s), false);
  assert.equal(evidenceCopied("", s), false);
});

// --- calibration §8.8 -------------------------------------------------------

const GRID = [C20, S3];
const runOk = (label: string): CalibrationRun => ({ label, reference: [15, 7], proposed: [13, 6] }); // écart 3, même bandes ±1

test("calibration passée : 5 dossiers, écart ≤ 8 et ≤ 1 bande partout", () => {
  const v = checkCalibration(GRID, [runOk("A"), runOk("B"), runOk("C"), runOk("D"), runOk("E")]);
  assert.equal(v.passed, true);
  assert.equal(v.runs.every((r) => r.ok), true);
});

test("calibration refusée : un dossier avec écart de total > 8 points", () => {
  const off: CalibrationRun = { label: "C", reference: [18, 9], proposed: [10, 5] }; // écart 12
  const v = checkCalibration(GRID, [runOk("A"), runOk("B"), off, runOk("D"), runOk("E")]);
  assert.equal(v.passed, false);
  assert.equal(v.runs[2]!.totalGap, 12);
});

test("calibration refusée : un critère dévie de 2 bandes malgré un total proche", () => {
  // C20 : réf 18 (bande 4) → proposé 11 (bande 2) ; S3 compense le total (écart 3 ≤ 8).
  const drift: CalibrationRun = { label: "D", reference: [18, 5], proposed: [11, 9] };
  const v = checkCalibration(GRID, [runOk("A"), runOk("B"), runOk("C"), drift, runOk("E")]);
  assert.equal(v.passed, false);
  assert.equal(v.runs[3]!.totalGap <= 8, true);
  assert.equal(v.runs[3]!.maxBandDeviation, 2);
});

test("calibration refusée : pas exactement 5 dossiers de référence", () => {
  const v = checkCalibration(GRID, [runOk("A"), runOk("B")]);
  assert.equal(v.passed, false);
  assert.equal(v.issues.length > 0, true);
});
