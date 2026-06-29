/**
 * bank.service.ts — reusable question bank (P1 slice 3a).
 *
 * Stores validated ScoredQuestions that authors insert into course quizzes,
 * tagged by sub-area for filtering and random draws.
 */
import { prisma } from "../../db/prisma.js";
import { ScoredQuestion } from "../../domain/content-model.js";

export class BankError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

export async function listBankQuestions(subArea?: string) {
  return prisma.bankQuestion.findMany({
    where: subArea ? { subArea } : {},
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function distinctSubAreas(): Promise<string[]> {
  const rows = await prisma.bankQuestion.findMany({ where: { subArea: { not: "" } }, select: { subArea: true }, distinct: ["subArea"] });
  return rows.map((r) => r.subArea).sort((a, b) => a.localeCompare(b));
}

export async function createBankQuestion(input: { question?: unknown; subArea?: string; level?: string; createdById?: string }) {
  let q;
  try { q = ScoredQuestion.parse(input.question); }
  catch (e) { throw new BankError(400, "invalid_question", (e as { issues?: { message: string }[] }).issues?.[0]?.message ?? "Question invalide"); }
  const subArea = (input.subArea ?? (q as { subArea?: string }).subArea ?? "").trim();
  return prisma.bankQuestion.create({ data: { question: q as object, subArea, level: input.level ?? "", createdById: input.createdById ?? null } });
}

export async function deleteBankQuestion(id: string) {
  await prisma.bankQuestion.deleteMany({ where: { id } });
  return { id };
}

type QuizContainer = { questions?: unknown[]; pool?: { subArea?: string; draw: number } };

/**
 * Materialise a quiz's questions for one learner: the fixed questions plus a
 * STABLE random draw from the bank. Stored once per (enrollment, quiz) so the
 * set is identical across bundle rebuilds and server-side scoring. No pool ⇒
 * the fixed questions, unchanged (backward-compatible).
 */
export async function materializeQuiz(enrollmentId: string, quizKey: string, container: QuizContainer): Promise<unknown[]> {
  const fixed = container.questions ?? [];
  if (!container.pool) return fixed;
  const existing = await prisma.quizDraw.findUnique({ where: { enrollmentId_quizKey: { enrollmentId, quizKey } } });
  if (existing) return existing.questions as unknown[];
  const drawn = await randomBankQuestions(container.pool.subArea, container.pool.draw);
  // Re-id drawn questions so they never collide with the fixed ones in the answers map.
  const reided = drawn.map((q, i) => ({ ...(q as Record<string, unknown>), id: `pool-${i}` }));
  const questions = [...fixed, ...reided];
  try { await prisma.quizDraw.create({ data: { enrollmentId, quizKey, questions: questions as object } }); }
  catch { const again = await prisma.quizDraw.findUnique({ where: { enrollmentId_quizKey: { enrollmentId, quizKey } } }); if (again) return again.questions as unknown[]; }
  return questions;
}

/** Draw up to `count` questions (optionally filtered by sub-area), shuffled. */
export async function randomBankQuestions(subArea: string | undefined, count: number): Promise<unknown[]> {
  const all = await prisma.bankQuestion.findMany({ where: subArea ? { subArea } : {}, select: { question: true } });
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all.slice(0, Math.max(0, count)).map((r) => r.question);
}
