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
import { normalizeWhitespace } from "../../domain/engine/ai-compliance.js";
import { aiAvailable, callClaudeText, effortFor, extractJson, stripMarkdown, supportsOutputConfig, type ClaudeRequest } from "./client.js";

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
  "temps). Tu donnes un retour FORMATIF sur une production écrite : exactement 2 points forts concrets, puis " +
  "2 pistes d'amélioration actionnables, en français, à la 2e personne du pluriel, jamais culpabilisant. Tu " +
  "rattaches tes remarques aux compétences visées et au contexte africain réel de l'apprenant. Tu ne donnes " +
  "PAS de note chiffrée. Tu désignes les compétences par leur INTITULÉ (« Gestion des priorités »), jamais par " +
  "un code de référentiel (D4.C2, S1…) — l'apprenant ne connaît pas ces codes. LONGUEUR : 250 mots maximum au total — sois sélectif, chaque point en 2 à 3 phrases, " +
  "et termine toujours ta dernière phrase (jamais de plan interrompu). FORMAT : texte brut uniquement, " +
  "l'interface n'affiche PAS le Markdown — aucun #, ##, **, *, ---, ni titre : des paragraphes courts, " +
  "éventuellement des puces « • ».";

export function buildFormativeRequest(input: FormativeInput): ClaudeRequest {
  // Intitulés seuls (P7) : donner les codes au modèle l'incitait à les citer.
  const comps = input.competencies.map((c) => c.label).join(" ; ");
  const user = [
    input.courseTitle ? `Parcours : « ${input.courseTitle} ».` : "",
    input.blockLabel ? `Bloc en cours : ${input.blockLabel}.` : "",
    input.promptContext ? `Consigne à laquelle l'apprenant répond :\n"""${input.promptContext}"""` : "",
    `Production de l'apprenant (« ${input.itemLabel} ») :`,
    `"""${input.submissionText}"""`,
    `Compétences visées : ${comps}.`,
    input.momentAncrage ? `Moment d'Ancrage de l'apprenant : « ${input.momentAncrage} ».` : "",
    "Rédige un retour formatif court (250 mots max, texte brut sans Markdown), SPÉCIFIQUE à cette réponse et à cette consigne : cite des éléments précis de la réponse (reformule-les), évalue leur adéquation à la consigne, puis donne des pistes concrètes ancrées dans le contexte du bloc. Jamais de retour générique. " +
    "Si la production contient plusieurs réponses numérotées (« Réponse 1 », « Réponse 2 »…), désigne chaque remarque par le numéro exact de la réponse concernée et vérifie que ton commentaire correspond bien au contenu de CETTE réponse — jamais de décalage.",
  ].filter(Boolean).join("\n");

  return {
    model: env.AI_MODEL,
    // Safety margin, not a shaping constraint: the 250-word target lives in the
    // system prompt; the cap only guarantees the model never stops mid-sentence.
    max_tokens: 8000,
    // Fort volume (1 appel par exercice écrit) × texte court : effort minimal.
    output_config: effortFor(env.AI_MODEL, "low"),
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
    const text = stripMarkdown(await callClaudeText(buildFormativeRequest(input)));
    return { feedback: text, aiGenerated: true, provider: env.AI_MODEL };
  } catch {
    return { feedback: fallbackFormative(input), aiGenerated: false, provider: "heuristic (ai-fallback)" };
  }
}

// ---------------------------------------------------------------------------
// Rubric score suggestion (evaluator-facing, advisory) — socle §8.
// Le modèle reçoit la grille COMPLÈTE (descripteurs de bande, minimums,
// « Où chercher la preuve ») et le livrable intégral — RIEN d'autre (§8.3) :
// ni identité du candidat, ni historique, ni Moment d'Ancrage. Il produit pour
// chaque critère une preuve (§8.4) : citations littérales OU déclaration
// d'absence. La vérification des citations appartient à la plateforme, jamais
// au modèle.
// ---------------------------------------------------------------------------

export type RubricCriterion = {
  label: string;
  competencyCode?: string;
  weightPoints: number;
  minPoints?: number;
  whereToLook?: string;
  bands?: { band: number; scoreRange: [number, number]; descriptor: string }[];
};

export type RubricInput = {
  projectText: string;
  criteria: RubricCriterion[];
  threshold: number;
};

export type SuggestedCriterionScore = {
  label: string;
  weightPoints: number;
  suggested: number;
  comment: string;
  citations?: string[];
  absence?: string;
};

export type RubricSuggestion = {
  perCriterion: SuggestedCriterionScore[];
  suggestedTotal: number;
  summary: string;
  aiGenerated: boolean;
  provider: string;
};

const RUBRIC_SYSTEM =
  "Tu es un assistant d'évaluation pour une certification professionnelle. Tu proposes une notation " +
  "INDICATIVE par critère, destinée à un évaluateur humain qui tranchera. ATTRIBUTION PAR BANDE : retiens " +
  "la bande la plus haute dont TOUS les éléments du descripteur sont démontrés par le livrable — un seul " +
  "élément manquant interdit la bande ; en cas de doute entre deux bandes, choisis la plus basse. " +
  "Pour CHAQUE critère tu fournis " +
  "exactement UNE des deux preuves : (a) \"citations\" — 1 à 3 extraits du livrable d'AU MOINS 8 mots " +
  "consécutifs chacun, copiés EXACTEMENT (mêmes mots, même ordre, sans ellipse ni reformulation) ; un " +
  "extrait de moins de 8 mots ne compte pas — préfère UN SEUL extrait long à plusieurs courts ; ou " +
  "(b) \"absence\" — uniquement si le score proposé est en bande basse (bandes 1-2) : une phrase indiquant " +
  "les sections parcourues, reprenant les mots de la ligne « Où chercher la preuve » du critère, et ce qui " +
  "n'y figure pas. Tu réponds UNIQUEMENT en JSON.";

/** Schéma JSON de la suggestion (sortie structurée) : mêmes champs que
 *  SuggestionSchema, tous requis — un « citations » vide ou un « absence »
 *  vide tiennent lieu d'omission (`normalize` les neutralise). L'API garantit
 *  alors un JSON valide : un guillemet non échappé du modèle a fait échouer
 *  une calibration entière (« Expected ',' or ']' … »). */
const SUGGESTION_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["perCriterion", "summary"],
  properties: {
    perCriterion: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "suggested", "comment", "citations", "absence"],
        properties: {
          label: { type: "string" },
          suggested: { type: "integer" },
          comment: { type: "string" },
          citations: { type: "array", items: { type: "string" } },
          absence: { type: "string" },
        },
      },
    },
    summary: { type: "string" },
  },
};

/** `output_config` de la notation : PAS d'effort (défaut du modèle — la
 *  justesse prime le coût, c'est ce que mesure la calibration §8.8), mais la
 *  sortie structurée quand le modèle la supporte. */
export function rubricOutputConfig(model: string): ClaudeRequest["output_config"] {
  return supportsOutputConfig(model)
    ? { format: { type: "json_schema", schema: SUGGESTION_JSON_SCHEMA } }
    : undefined;
}

const SuggestionSchema = z.object({
  perCriterion: z.array(z.object({
    label: z.string(),
    suggested: z.number(),
    comment: z.string().default(""),
    citations: z.array(z.string()).optional(),
    absence: z.string().optional(),
  })).min(1),
  summary: z.string(),
});

export function buildRubricRequest(input: RubricInput): ClaudeRequest {
  const crit = input.criteria.map((c) => {
    const bands = (c.bands ?? [])
      .slice().sort((a, b) => b.band - a.band)
      .map((b) => `    bande ${b.band} (${b.scoreRange[0]}-${b.scoreRange[1]} pts) : ${b.descriptor}`)
      .join("\n");
    return [
      `- "${c.label}" (max ${c.weightPoints} pts${c.minPoints != null ? `, minimum ${c.minPoints}` : ""}${c.competencyCode ? `, ${c.competencyCode}` : ""})`,
      bands,
      c.whereToLook ? `    Où chercher la preuve : ${c.whereToLook}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n");
  const user = [
    `Livrable soumis (intégral) :`,
    `"""${input.projectText}"""`,
    `Grille du parcours (somme = 100, seuil de certification = ${input.threshold}/100) :`,
    crit,
    `Réponds en JSON: {"perCriterion":[{"label":"...","suggested":<int ≤ max>,"comment":"...",` +
    `"citations":["extrait exact ≥ 8 mots", ...] OU "absence":"..."}],"summary":"..."} ` +
    `(le champ non utilisé reste vide : "citations":[] ou "absence":"").`,
  ].join("\n");

  return {
    model: env.AI_MODEL,
    // Marge, pas contrainte de forme : 6 critères × citations exactes font un
    // long JSON, et sur les modèles récents (claude-sonnet-5…) la RÉFLEXION
    // adaptative compte dans max_tokens — un plafond serré tronquait la réponse
    // (stop_reason=max_tokens) et faisait échouer la calibration.
    max_tokens: 16000,
    output_config: rubricOutputConfig(env.AI_MODEL),
    system: [{ type: "text", text: RUBRIC_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  };
}

/** Libellé comparable : minuscules, sans numérotation de tête (« 1 · », « 2. »)
 *  ni parenthèse de code finale (« (D4.C1) ») — le modèle décore volontiers. */
function comparableLabel(s: string): string {
  return s.trim().toLowerCase().replace(/^\d+\s*[·.—-]\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Clamp suggested points to [0, weight] and align to the rubric order.
 *  Appariement : libellé exact, puis libellé nettoyé, puis POSITION quand le
 *  modèle a répondu un score par critère — un simple préfixe ajouté par le
 *  modèle mettait sinon tout le dossier à 0 sans preuve. */
export function normalize(
  criteria: RubricCriterion[],
  suggested: z.infer<typeof SuggestionSchema>["perCriterion"],
): SuggestedCriterionScore[] {
  return criteria.map((c, i) => {
    const match =
      suggested.find((s) => s.label.trim().toLowerCase() === c.label.trim().toLowerCase())
      ?? suggested.find((s) => comparableLabel(s.label) === comparableLabel(c.label))
      ?? (suggested.length === criteria.length ? suggested[i] : undefined);
    const raw = match?.suggested ?? 0;
    const clamped = Math.max(0, Math.min(c.weightPoints, Math.round(raw)));
    return {
      label: c.label, weightPoints: c.weightPoints, suggested: clamped,
      comment: match?.comment || "Aucun commentaire.",
      citations: match?.citations?.length ? match.citations : undefined,
      absence: match?.absence || undefined,
    };
  });
}

/** Fallback hors-ligne déterministe : score de complétude + VRAIES citations
 *  extraites du livrable (fenêtres de 12 mots), pour que la vérification §8.4
 *  passe sans réseau. Sans 8 mots disponibles : déclaration d'absence. */
function fallbackRubric(input: RubricInput): RubricSuggestion {
  const words = normalizeWhitespace(input.projectText).split(" ").filter(Boolean);
  const len = input.projectText.trim().length;
  const factor = len >= 600 ? 0.75 : len >= 300 ? 0.6 : 0.45;
  const perCriterion = input.criteria.map((c, i): SuggestedCriterionScore => {
    const suggested = Math.round(c.weightPoints * factor);
    const base = {
      label: c.label, weightPoints: c.weightPoints, suggested,
      comment: "Suggestion indicative basée sur la complétude — relecture humaine requise.",
    };
    if (words.length >= 8) {
      const size = Math.min(12, words.length);
      const start = Math.min(i * 8, Math.max(0, words.length - size));
      return { ...base, citations: [words.slice(start, start + size).join(" ")] };
    }
    return {
      ...base,
      absence: `Livrable presque vide — sections parcourues sans résultat. ${c.whereToLook ?? ""} : rien de tel n'y figure.`.trim(),
    };
  });
  const suggestedTotal = perCriterion.reduce((a, x) => a + x.suggested, 0);
  return {
    perCriterion, suggestedTotal,
    summary: `Suggestion automatique non IA (${suggestedTotal}/100). À confirmer par l'évaluateur.`,
    aiGenerated: false, provider: "heuristic",
  };
}

/** `strict` (calibration §8.8) : mesurer le repli heuristique à la place du
 *  modèle rendrait le verdict mensonger — toute défaillance du modèle doit
 *  ÉCHOUER avec sa cause, jamais dégrader en silence. */
export async function suggestRubricScores(
  input: RubricInput,
  opts: { strict?: boolean } = {},
): Promise<RubricSuggestion> {
  if (!aiAvailable()) {
    if (opts.strict) throw new Error("ANTHROPIC_API_KEY non configurée — impossible de mesurer le modèle réel");
    return fallbackRubric(input);
  }
  try {
    const text = await callClaudeText(buildRubricRequest(input));
    const parsed = SuggestionSchema.parse(extractJson(text));
    const perCriterion = normalize(input.criteria, parsed.perCriterion);
    const suggestedTotal = perCriterion.reduce((a, x) => a + x.suggested, 0);
    return { perCriterion, suggestedTotal, summary: parsed.summary, aiGenerated: true, provider: env.AI_MODEL };
  } catch (e) {
    if (opts.strict) {
      throw new Error(`le modèle ${env.AI_MODEL} n'a pas produit de notation exploitable : ${e instanceof Error ? e.message : "erreur inconnue"}`);
    }
    return fallbackRubric(input);
  }
}
