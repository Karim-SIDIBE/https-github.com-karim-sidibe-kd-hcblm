/**
 * quiz.ts — client-side quiz scoring (mirrors the server) for instant feedback.
 * The server remains authoritative (the queued action re-scores + gates); this
 * only powers the immediate result screen, so it also works offline.
 */
export type ScoredQuestion = { id: string; correctKey: string; subArea?: string };

export function scoreQuiz(questions: ScoredQuestion[], answers: Record<string, string>) {
  const total = questions.length;
  const correct = questions.reduce((n, q) => n + (answers[q.id] === q.correctKey ? 1 : 0), 0);
  return { correct, total, scorePct: total ? Math.round((correct / total) * 100) : 0 };
}

export type SubAreaScore = { subArea: string; correct: number; total: number; pct: number };

/** Sub-area breakdown + the TWO WEAKEST areas as learning priorities (AC#17). */
export function diagnosticProfile(questions: ScoredQuestion[], answers: Record<string, string>) {
  const byArea = new Map<string, { correct: number; total: number }>();
  for (const q of questions) {
    const area = q.subArea?.trim() || "général";
    const s = byArea.get(area) ?? { correct: 0, total: 0 };
    s.total += 1;
    if (answers[q.id] === q.correctKey) s.correct += 1;
    byArea.set(area, s);
  }
  const subAreaScores: SubAreaScore[] = [...byArea.entries()].map(([subArea, s]) => ({
    subArea, correct: s.correct, total: s.total, pct: Math.round((s.correct / s.total) * 100),
  }));
  const priorities = subAreaScores
    .slice()
    .sort((a, b) => a.pct - b.pct || a.subArea.localeCompare(b.subArea))
    .slice(0, 2)
    .map((s) => s.subArea);
  return { ...scoreQuiz(questions, answers), subAreaScores, priorities };
}
