/**
 * feedback.service.ts — AI grading-assistant orchestration.
 *
 * Reads the relevant submission text from ItemCompletion.data, calls the AI
 * feedback module, and persists an AiAssessment (auditable, advisory). Never
 * writes a RUBRIC_EVALUATION — the human evaluator endpoint remains the gate.
 */
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { CourseContent, type Block, type CourseContent as CourseContentT } from "../../domain/content-model.js";
import { checkCalibration, verifyEvidence } from "../../domain/engine/ai-compliance.js";
import { hasPermission } from "../../domain/auth/permissions.js";
import { injectMomentAncrage } from "../../domain/engine/injection.js";
import { env } from "../../config/env.js";
import { aiAvailable } from "../../lib/ai/client.js";
import { generateFormativeFeedback, suggestRubricScores } from "../../lib/ai/feedback.js";
import type { Principal } from "../../lib/auth.js";

export class FeedbackError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

async function load(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { courseVersion: true, completions: true },
  });
  if (!enrollment) throw new FeedbackError(404, "not_found", "Inscription introuvable");
  const content: CourseContentT = CourseContent.parse(enrollment.courseVersion.content);
  return { enrollment, content };
}

function submissionText(data: unknown, orderedLabels?: string[]): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["text", "brief", "answer", "content", "response"]) {
      if (typeof d[k] === "string" && (d[k] as string).trim()) return (d[k] as string).trim();
    }
    // Guided-form exercises store { fields: { label → value } }. Serialised as
    // NUMBERED "Réponse n — label : value" lines in the CONTENT's field order
    // (never the typing order) so the formative feedback attributes each remark
    // to the right answer (retours de test, P4 — feedback décalé en 2.1).
    if (d.fields && typeof d.fields === "object") {
      const fields = d.fields as Record<string, unknown>;
      const known = (orderedLabels ?? []).filter((l) => l in fields);
      const rest = Object.keys(fields).filter((k) => !known.includes(k));
      const lines = [...known, ...rest]
        .filter((k) => typeof fields[k] === "string" && (fields[k] as string).trim())
        .map((k, i) => `Réponse ${i + 1} — ${k} : ${(fields[k] as string).trim()}`);
      if (lines.length) return lines.join("\n");
    }
    // Structured case studies store their reflections under { open: { id → text } }.
    if (d.open && typeof d.open === "object") {
      const lines = Object.values(d.open as Record<string, unknown>)
        .filter((v) => typeof v === "string" && (v as string).trim())
        .map((v) => (v as string).trim());
      if (lines.length) return lines.join("\n\n");
    }
  }
  if (typeof data === "string") return data.trim();
  return "";
}

/** Formative feedback on a learner's open submission (advisory).
 *  IDEMPOTENT par item : le premier feedback généré est celui que l'apprenant
 *  a lu — il oriente la suite de son parcours, donc il est conservé et renvoyé
 *  tel quel à chaque revisite (jamais régénéré, comme la réponse elle-même). */
export async function requestFormativeFeedback(enrollmentId: string, blockIndex: number, itemKey: string) {
  const { enrollment, content } = await load(enrollmentId);
  const completion = enrollment.completions.find((c) => c.blockIndex === blockIndex && c.itemKey === itemKey);
  if (!completion) throw new FeedbackError(404, "no_submission", "Aucune soumission pour cet item");

  const existing = await prisma.aiAssessment.findFirst({
    where: { enrollmentId, blockIndex, itemKey, kind: "FORMATIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  const block = content.blocks[blockIndex];
  const { itemLabel, promptContext, fieldLabels } = resolveItemContext(block, itemKey);
  const text = submissionText(completion.data, fieldLabels);
  if (!text) throw new FeedbackError(422, "empty_submission", "La soumission ne contient pas de texte à évaluer");
  const result = await generateFormativeFeedback({
    submissionText: text,
    itemLabel: itemLabel || (block?.title ? `${block.title} — ${itemKey}` : itemKey),
    competencies: content.competencies,
    momentAncrage: enrollment.momentAncrage,
    courseTitle: content.title,
    blockLabel: block ? `Bloc ${blockIndex} — ${block.title}` : undefined,
    promptContext: injectMomentAncrage(promptContext, enrollment.momentAncrage) || undefined,
  });

  return prisma.aiAssessment.create({
    data: {
      enrollmentId, blockIndex, itemKey, kind: "FORMATIVE",
      feedback: result.feedback, aiGenerated: result.aiGenerated, provider: result.provider,
    },
  });
}

/** Evaluator-facing rubric score suggestion for the Bloc 4 project (advisory). */
/** The item's learner-facing label and the exact consigne it answers — so the
 *  feedback speaks about THIS question, not about the platform in general. */
function resolveItemContext(block: Block | undefined, itemKey: string): { itemLabel: string; promptContext: string; fieldLabels?: string[] } {
  if (!block) return { itemLabel: itemKey, promptContext: "" };
  const p = block.payload as Record<string, any>;
  const ms = (p.microSessions as { id: string; title: string; exercise?: { prompt?: string; fields?: { label: string }[] } }[] | undefined)?.find((m) => m.id === itemKey);
  if (ms) return { itemLabel: ms.title, promptContext: ms.exercise?.prompt ?? "", fieldLabels: ms.exercise?.fields?.map((f) => f.label) };
  if (itemKey === "field" && p.fieldApplication) {
    const fa = p.fieldApplication as { title?: string; brief: string; steps?: { title: string; fields: { label: string }[] }[] };
    const steps = (fa.steps ?? []).map((st) => `${st.title} : ${st.fields.map((f) => f.label).join(" · ")}`).join("\n");
    return { itemLabel: fa.title || "Application terrain", promptContext: [fa.brief, steps].filter(Boolean).join("\n") };
  }
  if (itemKey === "case" && (p.caseStudy || p.transversalCase)) {
    const cs = (p.caseStudy ?? p.transversalCase) as { title: string; subtitle?: string; context?: string; structuredSteps?: { questions: { kind: string; prompt: string }[] }[] };
    const opens = (cs.structuredSteps ?? []).flatMap((st) => st.questions.filter((q) => q.kind === "open").map((q) => q.prompt)).join("\n");
    return { itemLabel: cs.subtitle || cs.title, promptContext: [cs.context, opens].filter(Boolean).join("\n") };
  }
  const jd = /^J\+(\d+)$/.exec(itemKey);
  if (jd && p.journal) {
    const entry = (p.journal.entries as { day: number; prompt: string }[]).find((e) => e.day === Number(jd[1]));
    if (entry) return { itemLabel: `Journal J+${entry.day}`, promptContext: entry.prompt };
  }
  if (itemKey.startsWith("project") && p.sections) {
    const i = itemKey === "project" ? 0 : Number(itemKey.split("@")[1] ?? 0);
    const sec = (p.sections as { title: string; helpText?: string }[])[i];
    if (sec) return { itemLabel: sec.title, promptContext: [p.projectBrief, sec.helpText].filter(Boolean).join("\n") };
  }
  return { itemLabel: itemKey, promptContext: "" };
}

/** Identifiant du moteur de suggestion courant — clé de calibration §8.8. */
export function currentAiProvider(): string {
  return aiAvailable() ? env.AI_MODEL : "heuristic";
}

const gridVersionOf = (v: { version: number; id: string }) => `v${v.version} (${v.id})`;

/**
 * Suggestion de notation (socle §8). Gardes, DANS L'ORDRE :
 *   §8.2 — réservée à l'évaluateur ASSIGNÉ au dossier ou à un administrateur ;
 *   §8.7 — indisponible en procédure de recours (notation à l'aveugle) ;
 *   §8.8 — indisponible tant que la calibration (parcours + modèle + version
 *          de grille) n'est pas passée ;
 *   §8.6 — ne s'affiche qu'APRÈS saisie et enregistrement du score humain ;
 *   §8.4/§8.5 — preuve vérifiée par la plateforme, tout-ou-rien : un critère
 *          en échec → aucune suggestion (l'échec est journalisé, §8.10).
 */
export async function requestRubricSuggestion(enrollmentId: string, principal?: Principal) {
  const { enrollment, content } = await load(enrollmentId);
  const cert = content.blocks.find((b) => b.type === "CERTIFICATION");
  if (cert?.type !== "CERTIFICATION") throw new FeedbackError(409, "no_block", "Bloc 4 absent");
  // The evaluated artefact is the ASSEMBLED submission (sections 1-5 + journal
  // chapter), not the Section-1 completion — progressive Bloc 4.
  const submission = await prisma.projectSubmission.findUnique({ where: { enrollmentId } });
  const project = enrollment.completions.find((c) => c.blockIndex === cert.index && c.itemKey === "project");
  if (!submission && !project) throw new FeedbackError(404, "no_submission", "Aucun projet soumis");

  if (principal) {
    const isAdmin = hasPermission(principal.role, "user:manage");
    if (!isAdmin && submission?.evaluatorId !== principal.id) {
      throw new FeedbackError(403, "not_assigned", "Suggestion réservée à l'évaluateur assigné au dossier ou à un administrateur (§8.2)");
    }
  }
  if ((submission?.appealStage ?? 0) > 0) {
    throw new FeedbackError(409, "ai_unavailable_recours", "Suggestion indisponible en procédure de recours : la notation du 2e/3e évaluateur est à l'aveugle (§8.7)");
  }

  const rubric = cert.payload.rubric;
  const gridVersion = gridVersionOf(enrollment.courseVersion);
  const provider = currentAiProvider();
  const calibration = await prisma.aiCalibration.findFirst({
    where: { courseId: enrollment.courseId, provider, gridVersion },
    orderBy: { createdAt: "desc" },
  });
  if (!calibration?.passed) {
    throw new FeedbackError(409, "ai_not_calibrated", `Suggestion désactivée sur ce parcours : calibration non passée pour ${provider} / ${gridVersion} (5 dossiers de référence, écart ≤ 8 pts, ≤ 1 bande — §8.8)`);
  }

  // §8.6 — prévention de l'ancrage : le score humain d'ABORD.
  const draft = (submission?.draftScores ?? null) as { points?: unknown }[] | null;
  const draftComplete = Array.isArray(draft) && draft.length === rubric.criteria.length
    && draft.every((d) => typeof d?.points === "number");
  if (!draftComplete) {
    throw new FeedbackError(409, "human_score_required", "La suggestion ne s'affiche qu'après saisie et enregistrement du score humain pour chaque critère (§8.6)");
  }

  const text = submissionText(submission?.content ?? project?.data);
  if (!text) throw new FeedbackError(422, "empty_submission", "Le projet ne contient pas de texte à évaluer");

  // §8.3 : grille complète + livrable intégral — rien d'autre.
  const suggestion = await suggestRubricScores({ projectText: text, criteria: rubric.criteria, threshold: rubric.threshold });

  // §8.4 : la vérification de la preuve appartient à la plateforme.
  const verdict = verifyEvidence(rubric.criteria, suggestion.perCriterion, text);
  const criteriaWithVerification = suggestion.perCriterion.map((c, i) => ({
    ...c, verification: verdict.perCriterion[i] ?? { label: c.label, ok: false, issues: ["missing"] },
  }));

  const stored = await prisma.aiAssessment.create({
    data: {
      enrollmentId, blockIndex: cert.index, itemKey: "project", kind: "RUBRIC_SUGGESTION",
      feedback: verdict.ok ? suggestion.summary : "Suggestion bloquée (§8.5) : la preuve d'au moins un critère n'a pas pu être vérifiée. L'évaluateur note sans assistance.",
      criteria: criteriaWithVerification as unknown as Prisma.InputJsonValue,
      suggestedScore: verdict.ok ? suggestion.suggestedTotal : null,
      aiGenerated: suggestion.aiGenerated, provider: suggestion.provider,
      gridVersion, blocked: !verdict.ok,
    },
  });
  if (!verdict.ok) {
    // §8.5 tout-ou-rien : rien ne s'affiche ; l'enregistrement bloqué reste
    // pour le taux de blocage par critère (§8.10).
    throw new FeedbackError(409, "suggestion_blocked", "Aucune suggestion pour ce dossier : preuve non vérifiable sur au moins un critère (§8.5). Notez sans assistance.");
  }
  return stored;
}

// ---------------------------------------------------------------------------
// Calibration de la suggestion (§8.8)
// ---------------------------------------------------------------------------

export type CalibrationRunInput = { label: string; text: string; reference: number[] };

/**
 * Passe la suggestion sur les 5 dossiers de référence du parcours et archive
 * le verdict. Les scores de référence ne sont JAMAIS fournis au modèle (§8.3) —
 * ils ne servent qu'à mesurer l'écart. Un dossier dont la preuve échoue au
 * §8.4 échoue la calibration : un moteur incapable de citer ne s'active pas.
 */
export async function runAiCalibration(courseId: string, runsInput: CalibrationRunInput[], createdById?: string) {
  const version = await prisma.courseVersion.findFirst({
    where: { courseId, status: "PUBLISHED" }, orderBy: { version: "desc" },
  });
  if (!version) throw new FeedbackError(404, "no_published_version", "Aucune version publiée pour ce parcours");
  const content = CourseContent.parse(version.content);
  const cert = content.blocks.find((b) => b.type === "CERTIFICATION");
  if (cert?.type !== "CERTIFICATION") throw new FeedbackError(409, "no_block", "Bloc 4 absent du parcours");
  const rubric = cert.payload.rubric;

  for (const run of runsInput) {
    if (run.reference.length !== rubric.criteria.length) {
      throw new FeedbackError(422, "reference_misaligned", `« ${run.label} » : ${rubric.criteria.length} scores de référence attendus (un par critère)`);
    }
    run.reference.forEach((pts, i) => {
      const c = rubric.criteria[i]!;
      if (!Number.isInteger(pts) || pts < 0 || pts > c.weightPoints) {
        throw new FeedbackError(422, "reference_out_of_range", `« ${run.label} » : score de référence invalide pour « ${c.label} » (${pts}, attendu 0..${c.weightPoints})`);
      }
    });
  }

  const evaluated: { label: string; reference: number[]; proposed: number[]; evidenceOk: boolean }[] = [];
  for (const run of runsInput) {
    // §8.8 en mode STRICT : la calibration mesure le modèle réel, jamais le
    // repli heuristique. Un appel en échec interrompt tout avec sa cause —
    // l'incident d'origine avait « refusé » une calibration qui n'avait en
    // réalité mesuré que le fallback (75/100 uniforme), sans un mot d'erreur.
    let suggestion;
    try {
      suggestion = await suggestRubricScores({ projectText: run.text, criteria: rubric.criteria, threshold: rubric.threshold }, { strict: true });
    } catch (e) {
      throw new FeedbackError(502, "ai_calibration_failed",
        `« ${run.label} » : ${e instanceof Error ? e.message : "erreur inconnue"}. Calibration interrompue — rien n'a été enregistré.`);
    }
    const evidence = verifyEvidence(rubric.criteria, suggestion.perCriterion, run.text);
    evaluated.push({
      label: run.label, reference: run.reference,
      proposed: suggestion.perCriterion.map((c) => c.suggested),
      evidenceOk: evidence.ok,
    });
  }
  const verdict = checkCalibration(rubric.criteria, evaluated);
  const results = verdict.runs.map((r, i) => ({
    ...r, evidenceOk: evaluated[i]?.evidenceOk ?? false, ok: r.ok && (evaluated[i]?.evidenceOk ?? false),
  }));
  const passed = verdict.issues.length === 0 && results.length > 0 && results.every((r) => r.ok);

  return prisma.aiCalibration.create({
    data: {
      courseId, provider: currentAiProvider(), gridVersion: gridVersionOf(version),
      results: results as unknown as Prisma.InputJsonValue, passed, createdById: createdById ?? null,
    },
  });
}

/** Statut d'activation de la suggestion sur un parcours : le DERNIER passage
 *  pour (parcours, modèle courant, version de grille courante) doit être
 *  `passed`. Changement de modèle ou révision de grille → nouvelle clé →
 *  recalibration exigée (§8.8). */
export async function aiCalibrationStatus(courseId: string) {
  const version = await prisma.courseVersion.findFirst({
    where: { courseId, status: "PUBLISHED" }, orderBy: { version: "desc" },
  });
  const provider = currentAiProvider();
  if (!version) return { active: false, provider, gridVersion: null, latest: null };
  const gridVersion = gridVersionOf(version);
  const latest = await prisma.aiCalibration.findFirst({
    where: { courseId, provider, gridVersion }, orderBy: { createdAt: "desc" },
  });
  return { active: Boolean(latest?.passed), provider, gridVersion, latest };
}

export async function listAssessments(enrollmentId: string) {
  await load(enrollmentId);
  return prisma.aiAssessment.findMany({ where: { enrollmentId }, orderBy: { createdAt: "asc" } });
}
