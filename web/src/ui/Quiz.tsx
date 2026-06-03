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
 * immediate per-question feedback before advancing.
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

  return (
    <div className="card stack">
      <div className="row between">
        <span className="muted">Question {idx + 1} / {questions.length}</span>
      </div>
      <div className="progress"><span style={{ width: `${((idx + (phase === "feedback" ? 1 : 0)) / questions.length) * 100}%` }} /></div>
      <p style={{ whiteSpace: "pre-wrap", fontWeight: 500 }}>{q.prompt}</p>

      <div className="stack">
        {q.options.map((o) => (
          <label key={o.key} className="row" style={{ margin: 0, alignItems: "flex-start", gap: 8, opacity: phase === "feedback" && q.correctKey && o.key !== q.correctKey && o.key !== chosen ? 0.6 : 1 }}>
            <input type="radio" name={q.id} style={{ width: "auto", marginTop: 4 }} disabled={phase === "feedback"}
              checked={chosen === o.key} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))} />
            <span>
              <strong>{o.key}.</strong> {o.label}
              {phase === "feedback" && q.correctKey === o.key && " ✅"}
              {phase === "feedback" && chosen === o.key && o.key !== q.correctKey && " ❌"}
            </span>
          </label>
        ))}
      </div>

      {phase === "answer" && <button className="block" disabled={!chosen} onClick={validate}>Valider</button>}

      {phase === "feedback" && (
        <div className="stack">
          {q.correctKey != null && <p className={`chip ${correct ? "ok" : "ko"}`} style={{ alignSelf: "flex-start" }}>{correct ? "Bonne réponse" : "À revoir"}</p>}
          {q.feedbackText && <div className="banner syncing" style={{ display: "block" }}><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{q.feedbackText}</p></div>}
          <button className="block" disabled={busy} onClick={next}>{busy ? "…" : last ? "Voir mon résultat →" : "Question suivante →"}</button>
        </div>
      )}
    </div>
  );
}
