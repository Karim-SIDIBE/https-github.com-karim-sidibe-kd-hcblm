/**
 * ai/feedback.ts — AI grading assistant (modern-LMS). Two products:
 *   1. FORMATIVE feedback on an open submission (field application, journal,
 *      project) — encouraging, specific, rubric/competency-aware, African-context
 *      aware. Learner-facing, advisory.
 *   2. RUBRIC SUGGESTION for the Bloc 4 project — a per-criterion provisional
 *      score the human EVALUATOR may use as a draft. NEVER applied automatically;
 *      certification remains a human decision (spec: "validation humaine").
 *
 * Pluggable with deterministic fallback when no key is configured.
 */
import { z } from "zod";
import { env } from "../../config/env.js";
import { aiAvailable, callClaudeText, extractJson, type ClaudeRequest } from "./client.js";

// ---------------------------------------------------------------------------
// Formative feedback
// ---------------------------------------------------------------------------

export type FormativeInput = {
  submissionText: string;
  itemLabel: string;
  competencies: { code: string; label: string }[];
  momentAncrage?: string | null;
};

export type FormativeResult = { feedback: string; aiGenerated: boolean; provider: string };

const FORMATIVE_SYSTEM =
  "Tu es un coach pédagogique bienveillant pour des professionnels en environnements africains (gestion du " +
  "temps). Tu donnes un retour FORMATIF sur une production écrite : 2 à 3 points forts concrets, puis 2 à 3 " +
  "pistes d'amélioration actionnables, en français, à la 2e personne du pluriel, jamais culpabilisant. Tu " +
  "rattaches tes remarques aux compétences visées et au contexte africain réel de l'apprenant. Tu ne donnes " +
  "PAS de note chiffrée.";

export function buildFormativeRequest(input: FormativeInput): ClaudeRequest {
  const comps = input.competencies.map((c) => `${c.code} — ${c.label}`).join(" ; ");
  const user = [
    `Production de l'apprenant (« ${input.itemLabel} ») :`,
    `"""${input.submissionText}"""`,
    `Compétences visées : ${comps}.`,
    input.momentAncrage ? `Moment d'Ancrage de l'apprenant : « ${input.momentAncrage} ».` : "",
    "Rédige un retour formatif structuré (points forts puis pistes d'amélioration).",
  ].filter(Boolean).join("\n");

  return {
    model: env.AI_MODEL,
    max_tokens: 600,
    system: [{ type: "text", text: FORMATIVE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  };
}

function fallbackFormative(input: FormativeInput): string {
  const len = input.submissionText.trim().length;
  const depth = len >= 400 ? "votre réponse est détaillée" : len >= 150 ? "votre réponse pose les bases" : "votre réponse est encore courte";
  const comps = input.competencies.map((c) => c.label).slice(0, 2).join(" et ");
  return [
    `Retour formatif (généré automatiquement — un évaluateur affinera) :`,
    `• Points forts : ${depth} et aborde le sujet « ${input.itemLabel} ».`,
    `• Pistes : ancrez davantage vos exemples dans votre contexte africain réel, et reliez-les explicitement aux compétences ${comps}.`,
    `• Prochaine étape : précisez un résultat concret et mesurable.`,
  ].join("\n");
}

export async function generateFormativeFeedback(input: FormativeInput): Promise<FormativeResult> {
  if (!aiAvailable()) return { feedback: fallbackFormative(input), aiGenerated: false, provider: "heuristic" };
  try {
    const text = await callClaudeText(buildFormativeRequest(input));
    return { feedback: text, aiGenerated: true, provider: env.AI_MODEL };
  } catch {
    return { feedback: fallbackFormative(input), aiGenerated: false, provider: "heuristic (ai-fallback)" };
  }
}

// ---------------------------------------------------------------------------
// Rubric score suggestion (evaluator-facing, advisory)
// ---------------------------------------------------------------------------

export type RubricCriterion = { label: string; competencyCode: string; weightPoints: number };

export type RubricInput = {
  projectText: string;
  criteria: RubricCriterion[];
  threshold: number;
  momentAncrage?: string | null;
};

export type RubricSuggestion = {
  perCriterion: { label: string; weightPoints: number; suggested: number; comment: string }[];
  suggestedTotal: number;
  summary: string;
  aiGenerated: boolean;
  provider: string;
};

const RUBRIC_SYSTEM =
  "Tu es un assistant d'évaluation pour une certification professionnelle (gestion du temps, contexte " +
  "africain). Tu proposes une notation INDICATIVE par critère, destinée à un évaluateur humain qui tranchera. " +
  "Tu es rigoureux mais juste, et tu justifies chaque score en une phrase. Tu réponds UNIQUEMENT en JSON.";

const SuggestionSchema = z.object({
  perCriterion: z.array(z.object({
    label: z.string(),
    suggested: z.number(),
    comment: z.string(),
  })).min(1),
  summary: z.string(),
});

export function buildRubricRequest(input: RubricInput): ClaudeRequest {
  const crit = input.criteria.map((c) => `- "${c.label}" (max ${c.weightPoints} pts${c.competencyCode ? `, ${c.competencyCode}` : ""})`).join("\n");
  const user = [
    `Projet certifiant soumis :`,
    `"""${input.projectText}"""`,
    `Grille (somme = 100, seuil de certification = ${input.threshold}/100) :`,
    crit,
    input.momentAncrage ? `Moment d'Ancrage : « ${input.momentAncrage} ».` : "",
    `Réponds en JSON: {"perCriterion":[{"label":"...","suggested":<int ≤ max>,"comment":"..."}],"summary":"..."}.`,
  ].filter(Boolean).join("\n");

  return {
    model: env.AI_MODEL,
    max_tokens: 1000,
    system: [{ type: "text", text: RUBRIC_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  };
}

/** Clamp suggested points to [0, weight] and align to the rubric order. */
function normalize(criteria: RubricCriterion[], suggested: { label: string; suggested: number; comment: string }[]) {
  return criteria.map((c) => {
    const match = suggested.find((s) => s.label.trim().toLowerCase() === c.label.trim().toLowerCase());
    const raw = match?.suggested ?? 0;
    const clamped = Math.max(0, Math.min(c.weightPoints, Math.round(raw)));
    return { label: c.label, weightPoints: c.weightPoints, suggested: clamped, comment: match?.comment ?? "Aucun commentaire." };
  });
}

function fallbackRubric(input: RubricInput): RubricSuggestion {
  const len = input.projectText.trim().length;
  const factor = len >= 600 ? 0.75 : len >= 300 ? 0.6 : 0.45;
  const perCriterion = input.criteria.map((c) => ({
    label: c.label,
    weightPoints: c.weightPoints,
    suggested: Math.round(c.weightPoints * factor),
    comment: "Suggestion indicative basée sur la complétude — relecture humaine requise.",
  }));
  const suggestedTotal = perCriterion.reduce((a, x) => a + x.suggested, 0);
  return {
    perCriterion, suggestedTotal,
    summary: `Suggestion automatique non IA (${suggestedTotal}/100). À confirmer par l'évaluateur.`,
    aiGenerated: false, provider: "heuristic",
  };
}

export async function suggestRubricScores(input: RubricInput): Promise<RubricSuggestion> {
  if (!aiAvailable()) return fallbackRubric(input);
  try {
    const text = await callClaudeText(buildRubricRequest(input));
    const parsed = SuggestionSchema.parse(extractJson(text));
    const perCriterion = normalize(input.criteria, parsed.perCriterion);
    const suggestedTotal = perCriterion.reduce((a, x) => a + x.suggested, 0);
    return { perCriterion, suggestedTotal, summary: parsed.summary, aiGenerated: true, provider: env.AI_MODEL };
  } catch {
    return fallbackRubric(input);
  }
}
