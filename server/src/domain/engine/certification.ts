/**
 * certification.ts — moteur de décision certifiante (socle commun d'évaluation
 * v1.1, §6). Pur : aucune I/O.
 *
 * Les conditions sont EXCLUSIVES et se lisent dans cet ordre — la règle des
 * minimums prime toujours sur le total :
 *   1. ≥ 2 minimums non atteints, ou total < 55  → NON CERTIFIÉ ;
 *   2. total ≥ 70 et tous les minimums atteints  → CERTIFIÉ ;
 *   3. sinon (55–69 avec ≤ 1 minimum manqué, ou ≥ 70 avec exactement 1)
 *                                                → REMISE DEMANDÉE
 *      (remise unique dans les 30 jours, réassignée au même évaluateur).
 *
 * Exemple du socle : un dossier à 62 points avec deux minimums manqués est
 * NON CERTIFIÉ, pas en remise.
 */

export type CriterionSpec = {
  label: string;
  weightPoints: number;
  minPoints?: number;
  bands?: { band: number; scoreRange: [number, number] }[];
};

export type CriterionScore = { points: number };

export type CertificationDecision = "CERTIFIED" | "RESUBMIT" | "NOT_CERTIFIED";

export type DecisionResult = {
  decision: CertificationDecision;
  total: number;
  threshold: number;
  /** Critères sous leur minimum (label + points/minimum). */
  minimumsMissed: { label: string; points: number; minPoints: number }[];
  /** Tous les minimums déclarés sont atteints. */
  allMinimumsMet: boolean;
};

/** Applique le §6 du socle à une série de scores par critère (même ordre que
 *  la grille). Lève si un score sort de [0, pondération]. */
export function decideCertification(
  criteria: CriterionSpec[],
  scores: CriterionScore[],
  threshold = 70,
): DecisionResult {
  if (scores.length !== criteria.length) {
    throw new Error(`scores (${scores.length}) et critères (${criteria.length}) désalignés`);
  }
  let total = 0;
  const minimumsMissed: DecisionResult["minimumsMissed"] = [];
  criteria.forEach((c, i) => {
    const pts = scores[i]!.points;
    if (!Number.isInteger(pts) || pts < 0 || pts > c.weightPoints) {
      throw new Error(`score invalide pour « ${c.label} » : ${pts} (0..${c.weightPoints})`);
    }
    total += pts;
    if (c.minPoints != null && pts < c.minPoints) minimumsMissed.push({ label: c.label, points: pts, minPoints: c.minPoints });
  });

  const allMinimumsMet = minimumsMissed.length === 0;
  let decision: CertificationDecision;
  if (minimumsMissed.length >= 2 || total < 55) decision = "NOT_CERTIFIED";
  else if (total >= threshold && allMinimumsMet) decision = "CERTIFIED";
  else decision = "RESUBMIT";

  return { decision, total, threshold, minimumsMissed, allMinimumsMet };
}

/** Bande dans laquelle tombe un score (bandes déclarées) — null hors bande. */
export function bandOf(criterion: CriterionSpec, points: number): number | null {
  for (const b of criterion.bands ?? []) {
    if (points >= b.scoreRange[0] && points <= b.scoreRange[1]) return b.band;
  }
  return null;
}

/** Contrôle du gabarit (§4) : bandes contiguës, sans trou ni recouvrement,
 *  couvrant toute la pondération (0 → weightPoints). Retourne les défauts. */
export function bandContiguityIssues(c: CriterionSpec): string[] {
  const issues: string[] = [];
  const bands = [...(c.bands ?? [])].sort((a, b) => a.scoreRange[0] - b.scoreRange[0]);
  if (bands.length === 0) return issues;
  if (bands[0]!.scoreRange[0] !== 0) issues.push(`la première bande doit commencer à 0 (actuel : ${bands[0]!.scoreRange[0]})`);
  const last = bands[bands.length - 1]!;
  if (last.scoreRange[1] !== c.weightPoints) issues.push(`la dernière bande doit finir à ${c.weightPoints} (actuel : ${last.scoreRange[1]})`);
  for (const b of bands) {
    if (b.scoreRange[1] < b.scoreRange[0]) issues.push(`bande ${b.band} : plage inversée`);
  }
  for (let i = 1; i < bands.length; i++) {
    const prev = bands[i - 1]!, cur = bands[i]!;
    if (cur.scoreRange[0] !== prev.scoreRange[1] + 1) {
      issues.push(`trou ou recouvrement entre ${prev.scoreRange[1]} et ${cur.scoreRange[0]}`);
    }
  }
  return issues;
}

/** Contrôle de non-compensation (socle §2.3 / gabarit §2) : le total maximal
 *  atteignable au STRICT minimum doit rester sous le seuil — un candidat ne
 *  peut pas être certifié en compensant des compétences non démontrées. */
export function nonCompensationCheck(criteria: CriterionSpec[], threshold = 70) {
  const minimumsSum = criteria.reduce((a, c) => a + (c.minPoints ?? 0), 0);
  const freeSum = criteria.filter((c) => c.minPoints == null).reduce((a, c) => a + c.weightPoints, 0);
  const maxAtStrictMinimums = minimumsSum + freeSum;
  return { minimumsSum, freeSum, maxAtStrictMinimums, ok: maxAtStrictMinimums < threshold };
}
