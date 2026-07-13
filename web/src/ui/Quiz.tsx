import { useRef, useState } from "react";
import { isAnswerCorrect } from "@kd/shared/scoring";
import { useT } from "../lib/i18n";

export type QuizQuestion = {
  id: string;
  prompt: string;
  type?: "single" | "multiple" | "truefalse" | "numeric" | "short";
  options?: { key: string; label: string }[];
  correctKey?: string;
  correctKeys?: string[];
  correctBool?: boolean;
  answerNumber?: number;
  tolerance?: number;
  accepted?: string[];
  feedbackText?: string;
};
export type QuestionMeta = Record<string, { timeMs: number; feedbackViewed: boolean }>;

/**
 * Quiz — one question at a time (mobile-friendly), capturing per-question time
 * and feedback-viewed for question-level xAPI. Renders the four scored question
 * types (single MCQ, multiple-select, true/false, numeric) with immediate
 * per-question feedback. Answers are type-encoded strings (see @kd/shared/scoring).
 */
export function Quiz({ questions, onSubmit }: {
  questions: QuizQuestion[];
  onSubmit: (answers: Record<string, string>, meta: QuestionMeta) => void | Promise<void>;
}) {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<QuestionMeta>({});
  const [phase, setPhase] = useState<"answer" | "feedback">("answer");
  const [busy, setBusy] = useState(false);
  const start = useRef(Date.now());

  const q = questions[idx]!;
  const type = q.type ?? "single";
  const last = idx === questions.length - 1;
  const chosen = answers[q.id] ?? "";
  const correct = isAnswerCorrect(q, chosen);
  const answered = phase === "answer";

  const set = (val: string) => { if (answered) setAnswers((a) => ({ ...a, [q.id]: val })); };
  const toggleMulti = (key: string) => {
    const cur = new Set(chosen.split(",").filter(Boolean));
    cur.has(key) ? cur.delete(key) : cur.add(key);
    set([...cur].sort().join(","));
  };
  const hasAnswer = type === "numeric" || type === "short" ? chosen.trim() !== "" : chosen !== "";

  function validate() {
    setMeta((m) => ({ ...m, [q.id]: { timeMs: Date.now() - start.current, feedbackViewed: true } }));
    setPhase("feedback");
  }
  async function next() {
    if (!last) { setIdx(idx + 1); setPhase("answer"); start.current = Date.now(); return; }
    setBusy(true);
    try { await onSubmit(answers, meta); } finally { setBusy(false); }
  }

  const pct = ((idx + (phase === "feedback" ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="hf-card stack">
      <div className="row between"><span className="eyebrow">{t("quiz.q", { n: idx + 1, total: questions.length })}</span></div>
      <div className="hf-prog"><i style={{ width: `${pct}%` }} /></div>
      <p className="h4" style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>{q.prompt}</p>

      {(type === "single" || type === "multiple") && (
        <div className="stack">
          {(q.options ?? []).map((o) => {
            const sel = type === "multiple" ? chosen.split(",").includes(o.key) : chosen === o.key;
            const isRight = phase === "feedback" && (type === "multiple" ? (q.correctKeys ?? []).includes(o.key) : q.correctKey === o.key);
            const isWrong = phase === "feedback" && sel && !isRight;
            const dim = phase === "feedback" && !isRight && !sel;
            return (
              <div key={o.key} className={`pt-opt ${sel ? "sel" : ""} ${isWrong ? "ko" : ""}`} role="button"
                style={{ opacity: dim ? 0.55 : 1, cursor: answered ? "pointer" : "default" }}
                onClick={() => { if (answered) (type === "multiple" ? toggleMulti(o.key) : set(o.key)); }}>
                <span className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                  <span className="hf-pill hf-pill--soft hf-pill--sm">{type === "multiple" ? (sel ? "☑" : "☐") : o.key}</span>
                  <span className="body" style={{ color: "var(--fg-1)" }}>{o.label}{isRight ? " ✅" : ""}{isWrong ? " ❌" : ""}</span>
                </span>
              </div>
            );
          })}
          {type === "multiple" && answered && <div className="meta">{t("quiz.multiHint")}</div>}
        </div>
      )}

      {type === "truefalse" && (
        <div className="row" style={{ gap: 10 }}>
          {(["true", "false"] as const).map((val) => {
            const sel = chosen === val;
            const isRight = phase === "feedback" && (val === "true") === Boolean(q.correctBool);
            const isWrong = phase === "feedback" && sel && !isRight;
            return (
              <button key={val} className={`hf-btn hf-btn--block ${sel ? "hf-btn--primary" : "hf-btn--outline"} ${isWrong ? "ko" : ""}`}
                disabled={!answered} onClick={() => set(val)} style={{ flex: 1, opacity: phase === "feedback" && !isRight && !sel ? 0.55 : 1 }}>
                {t(val === "true" ? "quiz.true" : "quiz.false")}{isRight ? " ✅" : ""}{isWrong ? " ❌" : ""}
              </button>
            );
          })}
        </div>
      )}

      {type === "numeric" && (
        <input className="hf-field" inputMode="decimal" type="text" placeholder={t("quiz.numPlaceholder")} value={chosen}
          disabled={!answered} onChange={(e) => set(e.target.value)} />
      )}

      {type === "short" && (
        <input className="hf-field" type="text" placeholder={t("quiz.shortPlaceholder")} value={chosen}
          disabled={!answered} onChange={(e) => set(e.target.value)} />
      )}

      {phase === "answer" && <button className="hf-btn hf-btn--primary hf-btn--block" disabled={!hasAnswer} onClick={validate}>{t("quiz.validate")}</button>}

      {phase === "feedback" && (
        <div className="stack pt-reveal">
          <span className={`hf-pill ${correct ? "hf-pill--mint" : "hf-pill--orange"}`} style={{ alignSelf: "flex-start" }}>{(q as any).profiling ? t("quiz.profileSaved") : correct ? t("quiz.good") : t("quiz.review")}</span>
          {type === "numeric" && !correct && q.answerNumber != null && <div className="meta">{t("quiz.expected", { n: q.answerNumber })}</div>}
          {type === "short" && !correct && (q.accepted?.length ?? 0) > 0 && <div className="meta">{t("quiz.accepted", { list: q.accepted!.join(", ") })}</div>}
          {q.feedbackText && <div className="hf-card hf-card--mint"><p className="body" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{q.feedbackText}</p></div>}
          <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy} onClick={next}>{busy ? "…" : last ? t("quiz.seeResult") : t("quiz.nextQuestion")}</button>
        </div>
      )}
    </div>
  );
}
