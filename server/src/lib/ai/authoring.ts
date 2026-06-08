/**
 * authoring.ts — AI-assisted course drafting.
 *
 * `draftCourseContent` returns a content document that ALWAYS conforms to the Zod
 * model: a deterministic, policy-valid scaffold is the backbone (PAM token at the
 * 4 touchpoints, rubric = 100, thresholds matching the level). When Claude is
 * configured it enriches the scaffold's wording; if the AI output fails the shape
 * gate, we safely keep the scaffold. The same publish gate then governs it.
 */
import { env } from "../../config/env.js";
import { aiAvailable, callClaudeText, extractJson, type ClaudeRequest } from "./client.js";
import { CourseContent, LEVEL_PASS_THRESHOLD, MOMENT_ANCRAGE_TOKEN, type CourseContent as CourseContentT } from "../../domain/content-model.js";

const T = MOMENT_ANCRAGE_TOKEN;

export type CourseBrief = {
  domainCode: string;
  domainLabel: string;
  level: 1 | 2 | 3;
  title?: string;
  audience?: string;
  competencies?: { code: string; label: string }[];
  language?: "fr";
};

export type DraftResult = { content: CourseContentT; aiGenerated: boolean; provider: string };

// --- deterministic, policy-valid scaffold -----------------------------------

const ms = (id: string, title: string, withPam = false) => ({
  id, title, durationEstimate: "20 min",
  summaryPoints: ["Point clé 1 (à compléter)", "Point clé 2 (à compléter)", "Point clé 3 (à compléter)"],
  video: { title, url: "", durationSec: 330, keyMessage: "Message clé à rédiger.", africanExample: "Exemple africain concret à nommer.", errorToAvoid: "Erreur classique à éviter.", scriptText: "" },
  exercise: {
    type: "written" as const,
    prompt: withPam ? `À partir de ${T}, mettez en pratique le concept de cette session.` : "Mettez en pratique le concept de cette session.",
    feedbackText: "Feedback à rédiger.", minChars: 120,
  },
});

export function buildScaffold(brief: CourseBrief): CourseContentT {
  const level = brief.level;
  const threshold = LEVEL_PASS_THRESHOLD[level];
  const competencies = brief.competencies?.length
    ? brief.competencies
    : [
        { code: `${brief.domainCode}.C1`, label: "Compétence 1" },
        { code: `${brief.domainCode}.C2`, label: "Compétence 2" },
        { code: `${brief.domainCode}.C3`, label: "Compétence 3" },
        { code: `${brief.domainCode}.C4`, label: "Compétence 4" },
      ];

  const draft: CourseContentT = {
    title: brief.title ?? `${brief.domainLabel} — Niveau ${level}`,
    level,
    language: "fr",
    domain: { code: brief.domainCode, label: brief.domainLabel },
    competencies,
    summary: `Parcours Niveau ${level} (brouillon généré — à compléter).`,
    objective: "À la fin de ce parcours, vous saurez… (à compléter)",
    audience: brief.audience ?? "Public cible à préciser.",
    durationEstimate: "~8 h",
    passThreshold: threshold,
    certificate: { title: `Certificat de Niveau ${level} — ${brief.domainLabel}`, openBadges2: true, verificationUrlPattern: "verify.declick.kompetences.net/c/{id}" },
    blocks: [
      {
        index: 0, type: "ONBOARDING", title: "Onboarding & Déclencheur", objective: "Engager l'apprenant.", durationEstimate: "~25 min",
        badge: { type: "ENTRY", label: "Badge d'Entrée", conditions: ["Moment d'Ancrage saisi", "Profil identifié", "Quiz déclencheur fait", "Pair nommé"] },
        payload: {
          momentAncrage: { promptText: "Décrivez une situation récente liée à ce thème dans votre organisation.", minChars: 50, placeholderExample: "Exemple à proposer…" },
          profileChoices: [
            { key: "A", name: "Profil A", description: "Description à rédiger." },
            { key: "B", name: "Profil B", description: "Description à rédiger." },
          ],
          triggerVideo: { title: "Vidéo déclencheur", url: "", durationSec: 600, keyMessage: "Message clé.", africanExample: "Exemple africain.", errorToAvoid: "Erreur à éviter.", scriptText: "" },
          triggerQuiz: { questions: [{ id: "t1", text: "Question de profilage ?", options: [{ key: "A", label: "Option A" }, { key: "B", label: "Option B" }] }] },
          progressPeer: { mandatory: true },
        },
      },
      {
        index: 1, type: "COMPREHENSION", title: "Comprendre", objective: "Poser les bases conceptuelles.", durationEstimate: "~2 h",
        badge: { type: "COMPREHENSION", label: "Badge Compréhension", conditions: ["Quiz diagnostique", "Micro-sessions complétées"] },
        payload: {
          diagnosticQuiz: {
            questions: [{ id: "d1", scenarioText: "Mise en situation à rédiger.", options: [{ key: "A", label: "Option A" }, { key: "B", label: "Option B" }], correctKey: "A", feedbackText: "Feedback à rédiger." }],
            profiles: [{ scoreRange: [0, 0], name: "Débutant", description: "" }, { scoreRange: [1, 1], name: "Confirmé", description: "" }],
          },
          microSessions: [ms("1.1", "Concept fondamental", true)],
        },
      },
      {
        index: 2, type: "PRACTICE", title: "Pratiquer", objective: "Mettre en pratique.", durationEstimate: "~2 h",
        badge: { type: "PRACTICE", label: "Badge Pratique", conditions: ["Micro-sessions", "Application terrain"] },
        payload: {
          microSessions: [ms("2.1", "Mise en pratique")],
          guidedScenarios: [],
          fieldApplication: { brief: `Appliquez dans votre environnement réel, à partir de ${T}.`, minChars: 200, gatesNextBlock: true },
        },
      },
      {
        index: 3, type: "ANCHORING", title: "Ancrer", objective: "Installer des habitudes.", durationEstimate: "~1 h 30",
        badge: { type: "ANCHORING", label: "Badge Ancrage", conditions: ["Micro-sessions", `Quiz final ≥ ${threshold} %`] },
        payload: {
          microSessions: [ms("3.1", "Rituel durable")],
          selfAssessment: { criteria: ["Critère 1", "Critère 2"], scale: ["1", "2", "3", "4"] },
          actionPlan30d: { habits: [{ title: "Habitude 1", fields: ["Quoi", "Quand", "Comment"] }] },
          finalQuiz: { questions: [{ id: "f1", scenarioText: "Mise en situation finale.", options: [{ key: "A", label: "Option A" }, { key: "B", label: "Option B" }], correctKey: "A", feedbackText: "Feedback." }], passThreshold: threshold },
        },
      },
      {
        index: 4, type: "CERTIFICATION", title: "Projet certifiant", objective: "Démontrer la maîtrise.", durationEstimate: "~1 h 30",
        badge: { type: "CERTIFICATE", label: `Certificat de Niveau ${level}`, conditions: ["Projet soumis", "Journal", `Grille ≥ ${threshold}/100`] },
        payload: {
          projectBrief: `Réalisez un projet appliqué à votre contexte réel, en repartant de ${T}.`,
          sections: [
            { title: "Section 1 — Contexte", helpText: "", prefillFromMomentAncrage: true },
            { title: "Section 2 — Solution", helpText: "", prefillFromMomentAncrage: false },
            { title: "Section 3 — Impact", helpText: "", prefillFromMomentAncrage: false },
            { title: "Section 4 — Journal", helpText: "", prefillFromMomentAncrage: false },
            { title: "Section 5 — Apprentissage", helpText: "", prefillFromMomentAncrage: false },
          ],
          journal: {
            entries: [
              { day: 1, prompt: "Première observation ?", minWords: 50 },
              { day: 3, prompt: `En repartant de ${T}, quel obstacle avez-vous rencontré ?`, minWords: 50 },
              { day: 5, prompt: "Quel ajustement ?", minWords: 50 },
              { day: 7, prompt: "Quel progrès ?", minWords: 50 },
              { day: 10, prompt: "Quelle résistance gérée ?", minWords: 50 },
              { day: 14, prompt: "Bilan ?", minWords: 50 },
            ],
          },
          rubric: {
            criteria: [
              { label: competencies[0]!.label, competencyCode: competencies[0]!.code, weightPoints: 25 },
              { label: competencies[1]?.label ?? "Critère 2", competencyCode: competencies[1]?.code ?? "", weightPoints: 25 },
              { label: competencies[2]?.label ?? "Critère 3", competencyCode: competencies[2]?.code ?? "", weightPoints: 25 },
              { label: "Ancrage contextuel + journal", competencyCode: competencies[3]?.code ?? "", weightPoints: 25 },
            ],
            totalPoints: 100,
            threshold,
          },
          evaluation: { humanEvaluator: true, turnaroundDays: 5, adminAlertAtDay: 5 },
        },
      },
    ],
  };
  return draft;
}

// --- optional Claude enrichment ---------------------------------------------

const ENRICH_SYSTEM =
  "Tu es un ingénieur pédagogique. On te fournit un SQUELETTE JSON de parcours (5 blocs fixes) et un brief. " +
  "Tu renvoies le MÊME JSON, structure et clés identiques, en remplaçant uniquement les textes de remplissage " +
  "(titres, messages clés, exemples africains, énoncés, feedbacks) par un contenu pertinent et concret. " +
  "Tu NE changes NI la structure, NI les clés, NI les seuils, NI les jetons {{moment_ancrage}}. Réponds UNIQUEMENT en JSON.";

function buildEnrichRequest(brief: CourseBrief, scaffold: CourseContentT): ClaudeRequest {
  return {
    model: env.AI_MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: ENRICH_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Brief: ${JSON.stringify(brief)}\nSquelette:\n${JSON.stringify(scaffold)}` }],
  };
}

export async function draftCourseContent(brief: CourseBrief): Promise<DraftResult> {
  const scaffold = buildScaffold(brief);
  if (!aiAvailable()) return { content: scaffold, aiGenerated: false, provider: "scaffold" };
  try {
    const text = await callClaudeText(buildEnrichRequest(brief, scaffold));
    const parsed = CourseContent.parse(extractJson(text)); // must satisfy the gate
    return { content: parsed, aiGenerated: true, provider: env.AI_MODEL };
  } catch {
    return { content: scaffold, aiGenerated: false, provider: "scaffold (ai-fallback)" };
  }
}
