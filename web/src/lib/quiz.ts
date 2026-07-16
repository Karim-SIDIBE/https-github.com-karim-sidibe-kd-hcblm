/**
 * quiz.ts — client-side quiz scoring (mirrors the server) for instant feedback.
 * The server remains authoritative (the queued action re-scores + gates); this
 * only powers the immediate result screen, so it also works offline.
 */
import { isAnswerCorrect, type ScorableQuestion } from "@kd/shared/scoring";

export type ScoredQuestion = { id: string; subArea?: string } & ScorableQuestion;

export function scoreQuiz(questions: ScoredQuestion[], answers: Record<string, string>) {
  const total = questions.length;
  const correct = questions.reduce((n, q) => n + (isAnswerCorrect(q, answers[q.id]) ? 1 : 0), 0);
  return { correct, total, scorePct: total ? Math.round((correct / total) * 100) : 0 };
}

export type SubAreaScore = { subArea: string; correct: number; total: number; pct: number };

/** Sub-area breakdown + the TWO WEAKEST areas as learning priorities (AC#17). */
export function diagnosticProfile(questions: ScoredQuestion[], answers: Record<string, string>) {
  const byArea = new Map<string, { correct: number; total: number }>();
  for (const q of questions) {
    // Profiling questions reveal a profile, they don't measure a competency —
    // keep them out of the sub-area analysis (mirrors the server engine).
    if (q.profiling) continue;
    const area = q.subArea?.trim() || "général";
    const s = byArea.get(area) ?? { correct: 0, total: 0 };
    s.total += 1;
    if (isAnswerCorrect(q, answers[q.id])) s.correct += 1;
    byArea.set(area, s);
  }
  const subAreaScores: SubAreaScore[] = [...byArea.entries()].map(([subArea, s]) => ({
    subArea, correct: s.correct, total: s.total, pct: Math.round((s.correct / s.total) * 100),
  }));
  // Only areas with an actual gap qualify as learning priorities — a 100% area
  // listed as "priority" reads as a bug to the learner.
  const priorities = subAreaScores
    .filter((s) => s.pct < 100)
    .sort((a, b) => a.pct - b.pct || a.subArea.localeCompare(b.subArea))
    .slice(0, 2)
    .map((s) => s.subArea);
  return { ...scoreQuiz(questions, answers), subAreaScores, priorities };
}
