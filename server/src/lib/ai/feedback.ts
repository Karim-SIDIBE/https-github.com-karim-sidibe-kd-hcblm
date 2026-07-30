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
  /** Course title — the feedback must speak the course's language. */
  courseTitle?: string;
  /** Current block ("Bloc 1 — Comprendre les dynamiques…"). */
  blockLabel?: string;
  /** The exact prompt/consigne the learner answered (PAM already injected). */
  promptContext?: string;
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
    input.courseTitle ? `Parcours : « ${input.courseTitle} ».` : "",
    input.blockLabel ? `Bloc en cours : ${input.blockLabel}.` : "",
    input.promptContext ? `Consigne à laquelle l'apprenant répond :\n"""${input.promptContext}"""` : "",
    `Production de l'apprenant (« ${input.itemLabel} ») :`,
    `"""${input.submissionText}"""`,
    `Compétences visées : ${comps}.`,
    input.momentAncrage ? `Moment d'Ancrage de l'apprenant : « ${input.momentAncrage} ».` : "",
    "Rédige un retour formatif structuré, SPÉCIFIQUE à cette réponse et à cette consigne : cite des éléments précis de la réponse (reformule-les), évalue leur adéquation à la consigne, puis donne des pistes concrètes ancrées dans le contexte du bloc. Jamais de retour générique.",
  ].filter(Boolean).join("\n");

  return {
    model: env.AI_MODEL,
    max_tokens: 600,
    system: [{ type: "text", text: FORMATIVE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  };
}

function fallbackFormative(input: FormativeInput): string {
  // Deterministic but SPECIFIC: quote the answer, measure it against the
  // consigne's own vocabulary, and point at what the consigne asks that the
  // answer does not yet cover. (A real AI key makes this fully personalised.)
  const text = input.submissionText.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const firstIdea = text.split(/(?<=[.!?])\s+/)[0]?.slice(0, 110) ?? "";
  const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9%]/g, "");
  const stop = new Set(["dans","avec","pour","votre","vous","les","des","une","est","qui","que","ce","cette","vos","son","ses","mon","mes","leur","plus","tout","tous","sans","sur","par","aux","the","and","your","with"]);
  const promptWords = [...new Set((input.promptContext ?? "").split(/\s+/).map(norm).filter((w) => w.length >= 5 && !stop.has(w)))];
  const answerWords = new Set(words.map(norm));
  const covered = promptWords.filter((w) => answerWords.has(w));
  const missing = promptWords.filter((w) => !answerWords.has(w)).slice(0, 3);
  const hasNumber = /\d/.test(text) || /\b(un|deux|trois|quatre|cinq|dix|quinze|vingt|trente|cent)\b/i.test(text);
  const comps = input.competencies.map((c) => c.label).slice(0, 2).join(" et ");
  const lines = [
    `Retour formatif (généré automatiquement — un évaluateur pourra affiner) :`,
    `• Ce que dit votre réponse : « ${firstIdea}${firstIdea.length >= 110 ? "…" : ""} » — ${words.length} mots sur « ${input.itemLabel} »${input.blockLabel ? ` (${input.blockLabel})` : ""}.`,
  ];
  if (promptWords.length > 0) {
    lines.push(covered.length > 0
      ? `• Adéquation à la consigne : vous reprenez ${covered.length} notion(s) attendue(s) (${covered.slice(0, 3).join(", ")}).${missing.length ? ` Pensez aussi à : ${missing.join(", ")}.` : ""}`
      : `• Adéquation à la consigne : votre réponse ne reprend pas encore les notions attendues${missing.length ? ` (${missing.join(", ")})` : ""} — relisez l'énoncé et ancrez chaque idée dedans.`);
  }
  lines.push(hasNumber
    ? `• Point fort : vous chiffrez votre réponse — gardez ce réflexe, un engagement mesurable se tient mieux.`
    : `• Piste : ajoutez un élément mesurable (durée, fréquence, pourcentage) — un engagement chiffré se tient mieux qu'une intention.`);
  lines.push(`• Prochaine étape : reliez explicitement votre réponse à votre réalité professionnelle (contexte, interlocuteurs) et aux compétences ${comps}.`);
  return lines.join("\n");
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
