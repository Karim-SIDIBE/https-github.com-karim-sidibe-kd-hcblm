/**
 * extract.ts — pure harvesting of scored questions from a course content
 * document (no I/O). Used to feed the question bank from published courses.
 *
 * Scored questions live in exactly three quiz containers:
 *  - Bloc 1  `payload.diagnosticQuiz.questions`
 *  - Bloc 2  `payload.interBlockQuiz.questions` (optional)
 *  - Bloc 3  `payload.finalQuiz.questions`
 * The Bloc 0 trigger quiz is non-scored (different shape) — out of scope.
 */
import type { ScoredQuestion } from "../content-model.js";

export type ExtractedQuestion = {
  question: ScoredQuestion;
  /** Which quiz the question came from. */
  quiz: "diagnostic" | "interblock" | "final";
  /** Stable provenance key within the course: "<quiz>:<questionId>". */
  key: string;
};

type QuizLike = { questions?: unknown[] } | undefined | null;
type BlockLike = { payload?: Record<string, unknown> | null } | undefined | null;
type ContentLike = { blocks?: unknown[] } | undefined | null;

function questionsOf(quiz: QuizLike): ScoredQuestion[] {
  if (!quiz || !Array.isArray(quiz.questions)) return [];
  // Content is validated at publish time; keep a light structural check anyway.
  return quiz.questions.filter(
    (q): q is ScoredQuestion => typeof q === "object" && q !== null && typeof (q as { id?: unknown }).id === "string",
  );
}

export function extractScoredQuestions(content: ContentLike): ExtractedQuestion[] {
  const out: ExtractedQuestion[] = [];
  const seen = new Set<string>();
  for (const raw of content?.blocks ?? []) {
    const payload = (raw as BlockLike)?.payload ?? {};
    const sources: [ExtractedQuestion["quiz"], QuizLike][] = [
      ["diagnostic", payload["diagnosticQuiz"] as QuizLike],
      ["interblock", payload["interBlockQuiz"] as QuizLike],
      ["final", payload["finalQuiz"] as QuizLike],
    ];
    for (const [quiz, container] of sources) {
      for (const question of questionsOf(container)) {
        const key = `${quiz}:${question.id}`;
        if (seen.has(key)) continue; // defensive: duplicate ids within a quiz
        seen.add(key);
        out.push({ question, quiz, key });
      }
    }
  }
  return out;
}
