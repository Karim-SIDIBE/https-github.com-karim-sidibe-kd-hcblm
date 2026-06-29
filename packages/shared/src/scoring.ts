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
  type?: "single" | "multiple" | "truefalse" | "numeric";
  correctKey?: string;
  correctKeys?: string[];
  correctBool?: boolean;
  answerNumber?: number;
  tolerance?: number;
};

export function isAnswerCorrect(q: ScorableQuestion, answer: string | undefined): boolean {
  const a = (answer ?? "").trim();
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
    case "single":
    default:
      return a !== "" && a === q.correctKey;
  }
}
