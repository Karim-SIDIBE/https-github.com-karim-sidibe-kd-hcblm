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
import { importCourseFromElements, type ImportCoverage } from "../../domain/authoring/import-course.js";
import type { DocElement } from "../docx.js";

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
          triggerDuration: "",
          triggerQuiz: { questions: [{ id: "t1", text: "Question de profilage ?", options: [{ key: "A", label: "Option A" }, { key: "B", label: "Option B" }] }] },
          progressPeer: { mandatory: true },
        },
      },
      {
        index: 1, type: "COMPREHENSION", title: "Comprendre", objective: "Poser les bases conceptuelles.", durationEstimate: "~2 h",
        badge: { type: "COMPREHENSION", label: "Badge Compréhension", conditions: ["Quiz diagnostique", "Micro-sessions complétées"] },
        payload: {
          diagnosticQuiz: {
            title: "",
            durationEstimate: "",
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
          guidedScenariosTitle: "",
          guidedScenariosDuration: "",
          guidedScenarios: [],
          fieldApplication: { title: "", durationEstimate: "", brief: `Appliquez dans votre environnement réel, à partir de ${T}.`, minChars: 200, gatesNextBlock: true },
        },
      },
      {
        index: 3, type: "ANCHORING", title: "Ancrer", objective: "Installer des habitudes.", durationEstimate: "~1 h 30",
        badge: { type: "ANCHORING", label: "Badge Ancrage", conditions: ["Micro-sessions", `Quiz final ≥ ${threshold} %`] },
        payload: {
          microSessions: [ms("3.1", "Rituel durable")],
          selfAssessment: { title: "", durationEstimate: "", criteria: ["Critère 1", "Critère 2"], scale: ["1", "2", "3", "4"] },
          actionPlan30d: { title: "", durationEstimate: "", intro: "", habits: [{ title: "Habitude 1", fields: ["Quoi", "Quand", "Comment"] }] },
          finalQuiz: { title: "", durationEstimate: "", questions: [{ id: "f1", scenarioText: "Mise en situation finale.", options: [{ key: "A", label: "Option A" }, { key: "B", label: "Option B" }], correctKey: "A", feedbackText: "Feedback." }], passThreshold: threshold },
        },
      },
      {
        index: 4, type: "CERTIFICATION", title: "Projet certifiant", objective: "Démontrer la maîtrise.", durationEstimate: "~1 h 30",
        badge: { type: "CERTIFICATE", label: `Certificat de Niveau ${level}`, conditions: ["Projet soumis", "Journal", `Grille ≥ ${threshold}/100`] },
        payload: {
          projectBrief: `Réalisez un projet appliqué à votre contexte réel, en repartant de ${T}.`,
          sections: [
            { title: "Section 1 — Contexte", helpText: "", durationEstimate: "", prefillFromMomentAncrage: true },
            { title: "Section 2 — Solution", helpText: "", durationEstimate: "", prefillFromMomentAncrage: false },
            { title: "Section 3 — Impact", helpText: "", durationEstimate: "", prefillFromMomentAncrage: false },
            { title: "Section 4 — Journal", helpText: "", durationEstimate: "", prefillFromMomentAncrage: false },
            { title: "Section 5 — Apprentissage", helpText: "", durationEstimate: "", prefillFromMomentAncrage: false },
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
            // Socle d'évaluation v1.1 (§1) : le seuil certifiant est de 70 à
            // TOUS les niveaux — l'exigence monte par les descripteurs et les
            // minimums, pas par le seuil (70/75/80 reste pour le quiz final).
            threshold: 70,
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
    max_tokens: 16000,
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

// --- import from a Word document --------------------------------------------

export type ImportResult = DraftResult & { blockNotes: Record<number, string>; coverage?: ImportCoverage };

const FROM_NOTES_SYSTEM =
  "Tu es ingénieur pédagogique. On te donne le JSON d'UN bloc de parcours déjà rempli et un RESTE de texte " +
  "du document source non réparti automatiquement. Tu renvoies le MÊME bloc JSON, structure et clés identiques, " +
  "en intégrant ce que ce texte apporte aux champs existants (titres, aides, feedbacks, points clés, descriptions). " +
  "Tu NE changes NI la structure, NI les clés, NI les identifiants, NI les seuils, NI les jetons {{moment_ancrage}}. " +
  "N'invente pas de vidéos (url et mediaId restent vides). Réponds UNIQUEMENT en JSON.";

function buildBlockRequest(block: unknown, notes: string): ClaudeRequest {
  return {
    model: env.AI_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: FROM_NOTES_SYSTEM, cache_control: { type: "ephemeral" } }],
    // Un appel PAR BLOC : chaque bloc voyage avec son propre texte, en entier —
    // plus aucune troncature globale du document.
    messages: [{ role: "user", content: `Bloc:\n${JSON.stringify(block)}\n\nTexte non réparti du bloc:\n${notes.slice(0, 60_000)}` }],
  };
}

/** Default neutral brief for an import — the designer sets the real domain after. */
const IMPORT_BRIEF: CourseBrief = { domainCode: "D1", domainLabel: "À définir", level: 1 };

/**
 * Construit un brouillon complet depuis les éléments structurés du document
 * (paragraphes + tableaux). Colonne vertébrale : le parseur DÉTERMINISTE du
 * gabarit K-HCBLM (domain/authoring/import-course) — blocs, micro-sessions,
 * vidéos et scripts, les 4 quiz complets, étude de cas, scénarios, application
 * terrain, auto-évaluation, plan d'action, Bloc 4 (sections + journal), cartes
 * de rappel, compétences du référentiel. Quand une clé IA est configurée, les
 * restes de CHAQUE bloc partent dans un appel dédié (aucune troncature) ; un
 * échec IA sur un bloc n'invalide jamais les autres ni la base déterministe.
 */
export async function draftCourseFromDoc(elements: DocElement[]): Promise<ImportResult> {
  const scaffold = buildScaffold(IMPORT_BRIEF);
  const det = importCourseFromElements(elements, scaffold);
  let content = det.content;
  let aiGenerated = false;
  let provider = "analyse déterministe (gabarit K-HCBLM)";

  if (aiAvailable()) {
    const enriched = structuredClone(content);
    let applied = 0;
    for (const [idxStr, note] of Object.entries(det.blockNotes)) {
      const idx = Number(idxStr);
      if (note.length < 400) continue; // trop peu de reste pour mériter un appel
      const pos = enriched.blocks.findIndex((b) => b.index === idx);
      if (pos < 0) continue;
      const before = enriched.blocks[pos]!;
      try {
        const text = await callClaudeText(buildBlockRequest(before, note));
        enriched.blocks[pos] = extractJson(text) as never;
        CourseContent.parse(enriched); // le bloc enrichi doit rester conforme
        applied++;
      } catch {
        enriched.blocks[pos] = before; // on garde la base déterministe
      }
    }
    if (applied > 0) {
      content = CourseContent.parse(enriched);
      aiGenerated = true;
      provider = `${env.AI_MODEL} (complément par bloc : ${applied})`;
    }
  }

  return { content, blockNotes: det.blockNotes, coverage: det.coverage, aiGenerated, provider };
}
