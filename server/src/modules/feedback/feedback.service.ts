/**
 * feedback.service.ts — AI grading-assistant orchestration.
 *
 * Reads the relevant submission text from ItemCompletion.data, calls the AI
 * feedback module, and persists an AiAssessment (auditable, advisory). Never
 * writes a RUBRIC_EVALUATION — the human evaluator endpoint remains the gate.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { CourseContent, type Block, type CourseContent as CourseContentT } from "../../domain/content-model.js";
import { injectMomentAncrage } from "../../domain/engine/injection.js";
import { generateFormativeFeedback, suggestRubricScores } from "../../lib/ai/feedback.js";

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

function submissionText(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["text", "brief", "answer", "content", "response"]) {
      if (typeof d[k] === "string" && (d[k] as string).trim()) return (d[k] as string).trim();
    }
    // Guided-form exercises store { fields: { label → value } } — serialise as
    // "label : value" lines so the formative feedback can read the answer.
    if (d.fields && typeof d.fields === "object") {
      const lines = Object.entries(d.fields as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string" && (v as string).trim())
        .map(([k, v]) => `${k} : ${(v as string).trim()}`);
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

/** Formative feedback on a learner's open submission (advisory). */
export async function requestFormativeFeedback(enrollmentId: string, blockIndex: number, itemKey: string) {
  const { enrollment, content } = await load(enrollmentId);
  const completion = enrollment.completions.find((c) => c.blockIndex === blockIndex && c.itemKey === itemKey);
  if (!completion) throw new FeedbackError(404, "no_submission", "Aucune soumission pour cet item");
  const text = submissionText(completion.data);
  if (!text) throw new FeedbackError(422, "empty_submission", "La soumission ne contient pas de texte à évaluer");

  const block = content.blocks[blockIndex];
  const { itemLabel, promptContext } = resolveItemContext(block, itemKey);
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
function resolveItemContext(block: Block | undefined, itemKey: string): { itemLabel: string; promptContext: string } {
  if (!block) return { itemLabel: itemKey, promptContext: "" };
  const p = block.payload as Record<string, any>;
  const ms = (p.microSessions as { id: string; title: string; exercise?: { prompt?: string } }[] | undefined)?.find((m) => m.id === itemKey);
  if (ms) return { itemLabel: ms.title, promptContext: ms.exercise?.prompt ?? "" };
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

export async function requestRubricSuggestion(enrollmentId: string) {
  const { enrollment, content } = await load(enrollmentId);
  const cert = content.blocks.find((b) => b.type === "CERTIFICATION");
  if (cert?.type !== "CERTIFICATION") throw new FeedbackError(409, "no_block", "Bloc 4 absent");
  // The evaluated artefact is the ASSEMBLED submission (sections 1-5 + journal
  // chapter), not the Section-1 completion — progressive Bloc 4.
  const submission = await prisma.projectSubmission.findUnique({ where: { enrollmentId } });
  const project = enrollment.completions.find((c) => c.blockIndex === cert.index && c.itemKey === "project");
  if (!submission && !project) throw new FeedbackError(404, "no_submission", "Aucun projet soumis");
  const text = submissionText(submission?.content ?? project?.data);
  if (!text) throw new FeedbackError(422, "empty_submission", "Le projet ne contient pas de texte à évaluer");

  const suggestion = await suggestRubricScores({
    projectText: text,
    criteria: cert.payload.rubric.criteria,
    threshold: cert.payload.rubric.threshold,
    momentAncrage: enrollment.momentAncrage,
  });

  return prisma.aiAssessment.create({
    data: {
      enrollmentId, blockIndex: cert.index, itemKey: "project", kind: "RUBRIC_SUGGESTION",
      feedback: suggestion.summary,
      criteria: suggestion.perCriterion as unknown as Prisma.InputJsonValue,
      suggestedScore: suggestion.suggestedTotal,
      aiGenerated: suggestion.aiGenerated, provider: suggestion.provider,
    },
  });
}

export async function listAssessments(enrollmentId: string) {
  await load(enrollmentId);
  return prisma.aiAssessment.findMany({ where: { enrollmentId }, orderBy: { createdAt: "asc" } });
}
