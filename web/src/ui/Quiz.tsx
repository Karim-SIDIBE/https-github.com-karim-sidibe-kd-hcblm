import { useRef, useState } from "react";

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: { key: string; label: string }[];
  correctKey?: string;
  feedbackText?: string;
};
export type QuestionMeta = Record<string, { timeMs: number; feedbackViewed: boolean }>;

/**
 * Quiz — one question at a time (mobile-friendly), capturing per-question
 * time-on-question and feedback-viewed for question-level xAPI (AC#11). Shows
 * immediate per-question feedback before advancing. Styled with the hf-* kit.
 */
export function Quiz({ questions, onSubmit }: {
  questions: QuizQuestion[];
  onSubmit: (answers: Record<string, string>, meta: QuestionMeta) => void | Promise<void>;
}) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<QuestionMeta>({});
  const [phase, setPhase] = useState<"answer" | "feedback">("answer");
  const [busy, setBusy] = useState(false);
  const start = useRef(Date.now());

  const q = questions[idx]!;
  const last = idx === questions.length - 1;
  const chosen = answers[q.id];
  const correct = q.correctKey != null && chosen === q.correctKey;

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
      <div className="row between"><span className="eyebrow">Question {idx + 1} / {questions.length}</span></div>
      <div className="hf-prog"><i style={{ width: `${pct}%` }} /></div>
      <p className="h4" style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>{q.prompt}</p>

      <div className="stack">
        {q.options.map((o) => {
          const sel = chosen === o.key;
          const isRight = phase === "feedback" && q.correctKey === o.key;
          const isWrong = phase === "feedback" && sel && o.key !== q.correctKey;
          const dim = phase === "feedback" && q.correctKey && !isRight && !sel;
          return (
            <div key={o.key} className={`pt-opt ${sel ? "sel" : ""} ${isWrong ? "ko" : ""}`} role="button"
              style={{ opacity: dim ? 0.55 : 1, cursor: phase === "feedback" ? "default" : "pointer" }}
              onClick={() => { if (phase === "answer") setAnswers((a) => ({ ...a, [q.id]: o.key })); }}>
              <span className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                <span className="hf-pill hf-pill--soft hf-pill--sm">{o.key}</span>
                <span className="body" style={{ color: "var(--fg-1)" }}>{o.label}{isRight ? " ✅" : ""}{isWrong ? " ❌" : ""}</span>
              </span>
            </div>
          );
        })}
      </div>

      {phase === "answer" && <button className="hf-btn hf-btn--primary hf-btn--block" disabled={!chosen} onClick={validate}>Valider</button>}

      {phase === "feedback" && (
        <div className="stack pt-reveal">
          {q.correctKey != null && <span className={`hf-pill ${correct ? "hf-pill--mint" : "hf-pill--orange"}`} style={{ alignSelf: "flex-start" }}>{correct ? "✓ Bonne réponse" : "À revoir"}</span>}
          {q.feedbackText && <div className="hf-card hf-card--mint"><p className="body" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{q.feedbackText}</p></div>}
          <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy} onClick={next}>{busy ? "…" : last ? "Voir mon résultat →" : "Question suivante →"}</button>
        </div>
      )}
    </div>
  );
}
