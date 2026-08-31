/**
 * ai-compliance.ts — conformité de la suggestion automatisée (socle commun
 * d'évaluation v1.1, §8). Pur : aucune I/O.
 *
 * La plateforme — jamais le modèle — vérifie la preuve produite pour chaque
 * critère (§8.4) : citation littérale d'au moins 8 mots consécutifs retrouvée
 * dans le livrable par comparaison exacte après normalisation des espaces
 * (3 extraits maximum), OU déclaration d'absence pour une bande basse
 * reprenant la ligne « Où chercher la preuve ». Si un seul critère échoue,
 * aucune suggestion ne s'affiche pour l'ensemble du dossier (§8.5).
 */
import { bandOf, type CriterionSpec } from "./certification.js";

export const MIN_CITATION_WORDS = 8;
export const MAX_EXTRACTS_PER_CRITERION = 3;
export const CALIBRATION_DOSSIERS = 5;
export const CALIBRATION_MAX_TOTAL_GAP = 8;
export const CALIBRATION_MAX_BAND_DEVIATION = 1;

export type ComplianceCriterion = CriterionSpec & { whereToLook?: string };

/** Preuve produite par le modèle pour un critère : citations OU absence. */
export type SuggestedCriterion = {
  label: string;
  suggested: number;
  comment?: string;
  citations?: string[];
  absence?: string;
};

/** Normalisation des espaces (§8.4) : toute suite de blancs → un espace. */
export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Typographie neutralisée (§8.4) : les apostrophes et guillemets
 *  typographiques (’ “ ” — introduits par les traitements de texte d'où les
 *  dossiers sont collés) valent leurs équivalents droits. Une citation
 *  honnête ne doit pas échouer sur un artefact d'encodage — l'exigence
 *  « mêmes mots, même ordre, ≥ 8 mots consécutifs » reste entière. */
export function normalizeTypography(s: string): string {
  return s.replace(/[’‘‛ʼ]/g, "'").replace(/[“”„]/g, '"');
}

const comparable = (s: string) => normalizeWhitespace(normalizeTypography(s));

const ELLIPSIS = /(\.{3}|…|\[\s*\.{2,}\s*\]|\[\s*…\s*\])/;

export type CitationIssue = "empty" | "ellipsis" | "too_short" | "not_found";

/** Vérifie UNE citation littérale contre le texte du livrable. null = valide. */
export function verifyCitation(extract: string, dossierText: string): CitationIssue | null {
  const c = comparable(extract);
  if (!c) return "empty";
  if (ELLIPSIS.test(extract)) return "ellipsis";
  if (c.split(" ").length < MIN_CITATION_WORDS) return "too_short";
  if (!comparable(dossierText).includes(c)) return "not_found";
  return null;
}

/** Bande basse = bandes 1-2 sur l'échelle du gabarit (sans bandes déclarées :
 *  moins de la moitié de la pondération). */
export function isLowBand(criterion: ComplianceCriterion, points: number): boolean {
  if (criterion.bands?.length) {
    const b = bandOf(criterion, points);
    return b !== null && b <= 2;
  }
  return points * 2 < criterion.weightPoints;
}

/** Deux textes partagent-ils `n` mots consécutifs (insensible à la casse) ?
 *  Sert à vérifier que la déclaration d'absence REPREND la ligne
 *  « Où chercher la preuve » du critère. */
export function sharesConsecutiveWords(a: string, b: string, n: number): boolean {
  const wa = comparable(a).toLowerCase().split(" ").filter(Boolean);
  const wb = comparable(b).toLowerCase().split(" ").filter(Boolean);
  if (wa.length < n || wb.length < n) return false;
  const grams = new Set<string>();
  for (let i = 0; i + n <= wa.length; i++) grams.add(wa.slice(i, i + n).join(" "));
  for (let i = 0; i + n <= wb.length; i++) if (grams.has(wb.slice(i, i + n).join(" "))) return true;
  return false;
}

export type CriterionVerification = { label: string; ok: boolean; issues: string[] };
export type EvidenceVerdict = { ok: boolean; perCriterion: CriterionVerification[] };

/**
 * Vérifie la preuve de CHAQUE critère (§8.4) et applique le tout-ou-rien
 * (§8.5) : `ok` global n'est vrai que si tous les critères passent.
 * `suggestions` doit être aligné sur `criteria` (même ordre).
 */
export function verifyEvidence(
  criteria: ComplianceCriterion[],
  suggestions: SuggestedCriterion[],
  dossierText: string,
): EvidenceVerdict {
  const perCriterion = criteria.map((c, i): CriterionVerification => {
    const s = suggestions[i];
    const issues: string[] = [];
    if (!s) return { label: c.label, ok: false, issues: ["missing"] };
    const citations = (s.citations ?? []).filter((x) => normalizeWhitespace(x));
    const absence = normalizeWhitespace(s.absence ?? "");

    // « l'un des deux éléments suivants, jamais aucun des deux »
    if (!citations.length && !absence) issues.push("no_evidence");
    if (citations.length && absence) issues.push("both_forms");

    if (citations.length) {
      if (citations.length > MAX_EXTRACTS_PER_CRITERION) issues.push("too_many_extracts");
      for (const extract of citations.slice(0, MAX_EXTRACTS_PER_CRITERION)) {
        const bad = verifyCitation(extract, dossierText);
        if (bad) issues.push(`citation:${bad}`);
      }
    } else if (absence) {
      if (!isLowBand(c, s.suggested)) issues.push("absence:not_low_band");
      if (c.whereToLook) {
        // Reprise de la ligne « Où chercher la preuve » : 4 mots consécutifs
        // partagés — ou la ligne entière quand elle est plus courte.
        const n = Math.min(4, normalizeWhitespace(c.whereToLook).split(" ").filter(Boolean).length);
        if (n > 0 && !sharesConsecutiveWords(absence, c.whereToLook, n)) {
          issues.push("absence:where_to_look_missing");
        }
      }
    }
    return { label: c.label, ok: issues.length === 0, issues };
  });
  return { ok: perCriterion.every((v) => v.ok), perCriterion };
}

/** La preuve humaine est-elle la reprise à l'identique d'une preuve IA
 *  (comparaison après normalisation des espaces) ? Indicateur §8.9/§8.10. */
export function evidenceCopied(humanEvidence: string, suggestion: SuggestedCriterion | undefined): boolean {
  if (!suggestion) return false;
  const h = normalizeWhitespace(humanEvidence);
  if (!h) return false;
  const pool = [...(suggestion.citations ?? []), ...(suggestion.absence ? [suggestion.absence] : [])]
    .map(normalizeWhitespace);
  return pool.includes(h);
}

// ---------------------------------------------------------------------------
// Calibration de la suggestion (§8.8) — seuil identique à l'habilitation
// humaine : écart de total ≤ 8 points sur CHACUN des 5 dossiers de référence,
// et aucun critère ne dévie de plus d'une bande.
// ---------------------------------------------------------------------------

export type CalibrationRun = {
  label: string;
  /** Scores de référence par critère (même ordre que la grille). */
  reference: number[];
  /** Scores proposés par la suggestion, même ordre. */
  proposed: number[];
};

export type CalibrationRunResult = {
  label: string;
  referenceTotal: number;
  proposedTotal: number;
  totalGap: number;
  maxBandDeviation: number;
  ok: boolean;
};

export type CalibrationVerdict = {
  passed: boolean;
  issues: string[];
  runs: CalibrationRunResult[];
};

export function checkCalibration(
  criteria: ComplianceCriterion[],
  runs: CalibrationRun[],
): CalibrationVerdict {
  const issues: string[] = [];
  if (runs.length !== CALIBRATION_DOSSIERS) {
    issues.push(`${CALIBRATION_DOSSIERS} dossiers de référence requis (${runs.length} fournis)`);
  }
  const results = runs.map((run): CalibrationRunResult => {
    if (run.reference.length !== criteria.length || run.proposed.length !== criteria.length) {
      issues.push(`« ${run.label} » : scores désalignés sur la grille (${criteria.length} critères)`);
      return { label: run.label, referenceTotal: 0, proposedTotal: 0, totalGap: Infinity, maxBandDeviation: Infinity, ok: false };
    }
    const referenceTotal = run.reference.reduce((a, x) => a + x, 0);
    const proposedTotal = run.proposed.reduce((a, x) => a + x, 0);
    const totalGap = Math.abs(proposedTotal - referenceTotal);
    let maxBandDeviation = 0;
    criteria.forEach((c, i) => {
      if (!c.bands?.length) return;
      const br = bandOf(c, run.reference[i]!);
      const bp = bandOf(c, run.proposed[i]!);
      if (br === null || bp === null) { maxBandDeviation = Math.max(maxBandDeviation, criteria.length); return; }
      maxBandDeviation = Math.max(maxBandDeviation, Math.abs(bp - br));
    });
    const ok = totalGap <= CALIBRATION_MAX_TOTAL_GAP && maxBandDeviation <= CALIBRATION_MAX_BAND_DEVIATION;
    return { label: run.label, referenceTotal, proposedTotal, totalGap, maxBandDeviation, ok };
  });
  return { passed: issues.length === 0 && results.length > 0 && results.every((r) => r.ok), issues, runs: results };
}
