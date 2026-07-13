/**
 * scoring.ts — pure, dependency-free quiz scoring shared by the server engine
 * and the learner PWA. Kept zod-free on purpose so the offline-first web bundle
 * can import it without pulling in zod.
 *
 * Answer encoding (the answers transport stays a plain Record<string,string>):
 *   single    → "A"            multiple → "A,C" (comma-joined option keys)
 *   truefalse → "true"/"false" numeric  → "42"
 */
export type ScorableQuestion = {
  type?: "single" | "multiple" | "truefalse" | "numeric" | "short";
  /** Profiling question: every non-empty answer is "correct" (it reveals a
   *  profile, it is not graded right/wrong). Excluded from priority analysis. */
  profiling?: boolean;
  correctKey?: string;
  correctKeys?: string[];
  correctBool?: boolean;
  answerNumber?: number;
  tolerance?: number;
  accepted?: string[];
};

/** Normalise free text for short-answer matching: trim, lowercase, strip accents
 *  and collapse whitespace, so "Délégation " ≈ "delegation". */
const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

export function isAnswerCorrect(q: ScorableQuestion, answer: string | undefined): boolean {
  const a = (answer ?? "").trim();
  if (q.profiling) return a !== ""; // any answer reveals a profile — never "wrong"
  switch (q.type ?? "single") {
    case "multiple": {
      const got = new Set(a.split(",").map((s) => s.trim()).filter(Boolean));
      const want = new Set(q.correctKeys ?? []);
      return want.size > 0 && got.size === want.size && [...want].every((k) => got.has(k));
    }
    case "truefalse":
      return (a === "true" || a === "false") && (a === "true") === Boolean(q.correctBool);
    case "numeric": {
      const n = Number(a.replace(",", "."));
      return Number.isFinite(n) && q.answerNumber != null && Math.abs(n - q.answerNumber) <= (q.tolerance ?? 0);
    }
    case "short": {
      if (!a) return false;
      const got = norm(a);
      return (q.accepted ?? []).some((acc) => norm(acc) === got);
    }
    case "single":
    default:
      return a !== "" && a === q.correctKey;
  }
}
