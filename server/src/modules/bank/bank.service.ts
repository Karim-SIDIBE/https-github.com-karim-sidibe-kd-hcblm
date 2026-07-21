/**
 * bank.service.ts — reusable question bank (P1 slice 3a).
 *
 * Stores validated ScoredQuestions that authors insert into course quizzes,
 * tagged by sub-area for filtering and random draws.
 */
import { prisma } from "../../db/prisma.js";
import { ScoredQuestion } from "../../domain/content-model.js";
import { extractScoredQuestions } from "../../domain/bank/extract.js";
import { shuffleQuestions } from "../../domain/engine/shuffle.js";

export class BankError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

export async function listBankQuestions(subArea?: string, status?: string) {
  return prisma.bankQuestion.findMany({
    where: { ...(subArea ? { subArea } : {}), ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
}

/** Approve a pending question (make it drawable by pools). */
export async function approveBankQuestion(id: string) {
  const q = await prisma.bankQuestion.findUnique({ where: { id } });
  if (!q) throw new BankError(404, "not_found", "Question introuvable");
  return prisma.bankQuestion.update({ where: { id }, data: { status: "approved" } });
}

/**
 * Harvest every scored question of a course's latest PUBLISHED version into
 * the bank. Idempotent: re-importing (or re-publishing) upserts by provenance
 * (courseId + quiz-scoped question id) instead of duplicating. Harvested
 * questions are human-authored and already went through the publish gate, so
 * they enter as "approved".
 */
export async function importFromCourse(courseId: string, opts: { createdById?: string } = {}) {
  const version = await prisma.courseVersion.findFirst({
    where: { courseId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
  if (!version) throw new BankError(404, "not_published", "Aucune version publiée pour ce parcours");
  const content = version.content as { level?: number; domain?: { label?: string } };
  const items = extractScoredQuestions(version.content as never);
  const fallbackSubArea = content.domain?.label?.trim() ?? "";
  const level = content.level != null ? String(content.level) : "";
  let created = 0;
  let updated = 0;
  for (const it of items) {
    const subArea = it.question.subArea?.trim() || fallbackSubArea;
    const existing = await prisma.bankQuestion.findUnique({
      where: { sourceCourseId_sourceQuestionId: { sourceCourseId: courseId, sourceQuestionId: it.key } },
    });
    if (existing) {
      await prisma.bankQuestion.update({
        where: { id: existing.id },
        data: { question: it.question as object, subArea, level },
      });
      updated++;
    } else {
      await prisma.bankQuestion.create({
        data: {
          question: it.question as object, subArea, level,
          status: "approved", origin: "course", note: it.quiz,
          sourceCourseId: courseId, sourceQuestionId: it.key,
          createdById: opts.createdById ?? null,
        },
      });
      created++;
    }
  }
  return { total: items.length, created, updated };
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
 * STABLE random draw from the bank when a pool is configured. The final list is
 * served in a RANDOM ORDER that is stable per (enrollment, quiz) — seeded
 * shuffle, so the offline bundle, every rebuild and the server-side scoring
 * all agree, while two learners see different orders (anti-copying). Profiling
 * questions stay pinned at the end (designed as closing questions). Scoring is
 * id-based, so the order never affects results.
 */
export async function materializeQuiz(enrollmentId: string, quizKey: string, container: QuizContainer): Promise<unknown[]> {
  const seed = `${enrollmentId}:${quizKey}`;
  const shuffle = (qs: unknown[]) => shuffleQuestions(qs as { profiling?: boolean }[], seed);
  const fixed = container.questions ?? [];
  if (!container.pool) return shuffle(fixed);
  const existing = await prisma.quizDraw.findUnique({ where: { enrollmentId_quizKey: { enrollmentId, quizKey } } });
  if (existing) return shuffle(existing.questions as unknown[]);
  const drawn = await randomBankQuestions(container.pool.subArea, container.pool.draw);
  // Re-id drawn questions so they never collide with the fixed ones in the answers map.
  const reided = drawn.map((q, i) => ({ ...(q as Record<string, unknown>), id: `pool-${i}` }));
  const questions = [...fixed, ...reided];
  try { await prisma.quizDraw.create({ data: { enrollmentId, quizKey, questions: questions as object } }); }
  catch { const again = await prisma.quizDraw.findUnique({ where: { enrollmentId_quizKey: { enrollmentId, quizKey } } }); if (again) return shuffle(again.questions as unknown[]); }
  return shuffle(questions);
}

/** Draw up to `count` APPROVED questions (optionally by sub-area), shuffled.
 *  Pending (unreviewed) questions are never served to learners. */
export async function randomBankQuestions(subArea: string | undefined, count: number): Promise<unknown[]> {
  const all = await prisma.bankQuestion.findMany({ where: { status: "approved", ...(subArea ? { subArea } : {}) }, select: { question: true } });
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all.slice(0, Math.max(0, count)).map((r) => r.question);
}
