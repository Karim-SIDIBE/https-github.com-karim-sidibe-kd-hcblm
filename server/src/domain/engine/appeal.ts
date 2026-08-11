/**
 * appeal.ts — procédure de recours (socle commun d'évaluation v1.1, §10) et
 * surveillance continue (§9.3). Pur : aucune I/O.
 *
 * §10 — un candidat conteste devant une instance distincte de celle qui a
 * décidé : contestation écrite sous 15 jours calendaires (étape 1), second
 * évaluateur désigné sous 5 jours ouvrables (étape 2), notation à l'aveugle
 * sous 10 jours ouvrables (étape 3), résolution immédiate (étape 4 : écart
 * < 10 → la moyenne fait foi ; ≥ 10 → un troisième évaluateur tranche),
 * notification motivée sous 3 jours ouvrables (étape 5). La décision issue
 * du recours est FINALE.
 *
 * §9.3 — 10 % des dossiers réels notés en double à l'aveugle ; médiane
 * trimestrielle des écarts > 8 → grille révisée ou évaluateurs recalibrés ;
 * écart individuel > 15 → un troisième évaluateur tranche, incident consigné.
 */

/** Étape 1 : fenêtre de contestation (jours calendaires après la décision). */
export const APPEAL_WINDOW_DAYS = 15;
/** Étape 2 : désignation du second évaluateur (jours ouvrables). */
export const APPEAL_ASSIGN_BUSINESS_DAYS = 5;
/** Étape 3 : notation à l'aveugle (jours ouvrables). */
export const APPEAL_GRADE_BUSINESS_DAYS = 10;
/** Étape 5 : notification écrite motivée (jours ouvrables). */
export const APPEAL_NOTIFY_BUSINESS_DAYS = 3;
/** Étape 4 : à partir de cet écart de totaux, un troisième évaluateur tranche. */
export const APPEAL_THIRD_EVALUATOR_GAP = 10;

/** §9.3 : part des dossiers réels notés en double (1 sur N). */
export const QC_DOUBLE_MARKING_EVERY = 10;
/** §9.3 : médiane trimestrielle des écarts au-delà de laquelle on révise. */
export const QC_MEDIAN_ALERT = 8;
/** §9.3 : écart individuel qui déclenche un incident (troisième évaluateur). */
export const QC_INCIDENT_GAP = 15;

/** L'étape 1 est-elle encore ouverte ? (15 jours calendaires, bornes incluses) */
export function appealWindowOpen(evaluatedAt: Date, now: Date): boolean {
  const ms = now.getTime() - evaluatedAt.getTime();
  return ms >= 0 && ms <= APPEAL_WINDOW_DAYS * 86_400_000;
}

/** `n` jours ouvrables (lun-ven, jours UTC) après `from`. */
export function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return d;
}

export type AppealResolution = {
  gap: number;
  /** Écart ≥ 10 : un troisième évaluateur tranche (sa décision est définitive). */
  needsThird: boolean;
  /** Écart < 10 : moyenne par critère (arrondie), qui fait foi. */
  averagedScores: number[] | null;
};

/** Étape 4 — immédiate, dès la notation du second évaluateur. */
export function resolveAppeal(firstScores: number[], secondScores: number[]): AppealResolution {
  if (firstScores.length !== secondScores.length) {
    throw new Error(`notations désalignées (${firstScores.length} vs ${secondScores.length} critères)`);
  }
  const t1 = firstScores.reduce((a, x) => a + x, 0);
  const t2 = secondScores.reduce((a, x) => a + x, 0);
  const gap = Math.abs(t1 - t2);
  if (gap >= APPEAL_THIRD_EVALUATOR_GAP) return { gap, needsThird: true, averagedScores: null };
  return {
    gap, needsThird: false,
    averagedScores: firstScores.map((p, i) => Math.round((p + secondScores[i]!) / 2)),
  };
}

/** §9.3 : ce dossier (n-ième noté du parcours, 1-indexé) part-il en double
 *  notation ? Un sur dix, déterministe. */
export function shouldDoubleMark(gradedSequence: number): boolean {
  return gradedSequence > 0 && gradedSequence % QC_DOUBLE_MARKING_EVERY === 0;
}

export type QcSummary = {
  count: number;
  medianGap: number | null;
  /** Médiane > 8 : réviser la grille ou recalibrer les évaluateurs. */
  medianAlert: boolean;
  /** Écarts > 15 : incidents individuels (un troisième évaluateur tranche). */
  incidents: number;
};

/** Synthèse des doubles notations d'un trimestre. */
export function qcSummary(gaps: number[]): QcSummary {
  const sorted = [...gaps].sort((a, b) => a - b);
  const n = sorted.length;
  const medianGap = n === 0 ? null
    : n % 2 === 1 ? sorted[(n - 1) / 2]!
    : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  return {
    count: n,
    medianGap,
    medianAlert: medianGap !== null && medianGap > QC_MEDIAN_ALERT,
    incidents: gaps.filter((g) => g > QC_INCIDENT_GAP).length,
  };
}
