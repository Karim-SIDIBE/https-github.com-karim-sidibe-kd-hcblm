/**
 * feedback.service.ts — AI grading-assistant orchestration.
 *
 * Reads the relevant submission text from ItemCompletion.data, calls the AI
 * feedback module, and persists an AiAssessment (auditable, advisory). Never
 * writes a RUBRIC_EVALUATION — the human evaluator endpoint remains the gate.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { CourseContent, type CourseContent as CourseContentT } from "../../domain/content-model.js";
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
  const result = await generateFormativeFeedback({
    submissionText: text,
    itemLabel: block?.title ? `${block.title} — ${itemKey}` : itemKey,
    competencies: content.competencies,
    momentAncrage: enrollment.momentAncrage,
  });

  return prisma.aiAssessment.create({
    data: {
      enrollmentId, blockIndex, itemKey, kind: "FORMATIVE",
      feedback: result.feedback, aiGenerated: result.aiGenerated, provider: result.provider,
    },
  });
}

/** Evaluator-facing rubric score suggestion for the Bloc 4 project (advisory). */
export async function requestRubricSuggestion(enrollmentId: string) {
  const { enrollment, content } = await load(enrollmentId);
  const cert = content.blocks.find((b) => b.type === "CERTIFICATION");
  if (cert?.type !== "CERTIFICATION") throw new FeedbackError(409, "no_block", "Bloc 4 absent");
  const project = enrollment.completions.find((c) => c.blockIndex === cert.index && c.itemKey === "project");
  if (!project) throw new FeedbackError(404, "no_submission", "Aucun projet soumis");
  const text = submissionText(project.data);
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
