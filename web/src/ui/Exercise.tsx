import { useRef, useState } from "react";
import type { Exercise as ExerciseSpec } from "@kd/shared";
import { useT } from "../lib/i18n";

export type { ExerciseSpec };
export type ExerciseMeta = { timeMs: number; feedbackViewed: boolean; response?: string; correct?: boolean };

/**
 * Exercise — the interactive exercise shown immediately after the video (§5.1),
 * styled to the Declick prototype (peach "Moment d'Ancrage" prompt, option cards,
 * green feedback). It is the completion gate: the learner cannot advance until
 * they answer and read the feedback. Emits xAPI meta (AC#11).
 */
export function Exercise({ exercise, onComplete, onNext }: { exercise: ExerciseSpec; onComplete: (data: unknown, meta: ExerciseMeta) => void | Promise<void>; onNext: () => void }) {
  const t = useT();
  const start = useRef(Date.now());
  const [phase, setPhase] = useState<"answer" | "feedback">("answer");
  const [choice, setChoice] = useState<string>("");
  const [text, setText] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const minChars = exercise.minChars ?? 200;
  const canAnswer =
    exercise.type === "multi" ? choice !== "" :
    exercise.type === "written" ? text.trim().length >= minChars :
    (exercise.fields ?? []).every((f) => (values[f.label] ?? "").trim().length > 0);

  function response(): string {
    if (exercise.type === "multi") return choice;
    if (exercise.type === "written") return text.trim();
    return JSON.stringify(values);
  }
  // « Valider ma réponse » PERSISTS the answer immediately (queued offline if
  // needed) — leaving after reading the feedback can no longer lose the work.
  async function validate() {
    setBusy(true);
    const correct = exercise.type === "multi" ? choice === exercise.correctKey : undefined;
    const meta: ExerciseMeta = { timeMs: Date.now() - start.current, feedbackViewed: true, response: response(), correct };
    const data = exercise.type === "multi" ? { choice } : exercise.type === "written" ? { text: text.trim() } : { fields: values };
    try { await onComplete(data, meta); setPhase("feedback"); } finally { setBusy(false); }
  }
  const isCorrect = exercise.type === "multi" && choice === exercise.correctKey;

  return (
    <div className="hf-card hf-card--stripe-orange stack">
      <div className="eyebrow">{t("ex.eyebrow")}</div>

      <div className="hf-pam">
        <span className="tag">{t("ob.pamTag")}</span>
        <div className="quote" style={{ whiteSpace: "pre-wrap" }}>{exercise.prompt}</div>
      </div>

      {phase === "answer" && (
        <div className="stack">
          {exercise.type === "multi" && (exercise.options ?? []).map((o) => (
            <div key={o.key} className={`pt-opt ${choice === o.key ? "sel" : ""}`} onClick={() => setChoice(o.key)} role="button">
              <strong className="h4"><span className="hf-pill hf-pill--soft hf-pill--sm" style={{ marginRight: 8 }}>{o.key}</span>{o.label}</strong>
            </div>
          ))}

          {exercise.type === "written" && (
            <div className="hf-textwrap">
              <textarea className="hf-field" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("answerPlaceholder")} style={{ minHeight: 150 }}
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
              <span className="hf-count" style={{ color: text.trim().length >= minChars ? "var(--brand-declick)" : undefined }}>{text.trim().length} / {minChars}</span>
            </div>
          )}

          {exercise.type === "guidedForm" && (exercise.fields ?? []).map((f) => (
            <label key={f.label}>{f.label}
              <input className="hf-field" value={values[f.label] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))}
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
            </label>
          ))}

          <button className="hf-btn hf-btn--primary hf-btn--block" disabled={!canAnswer || busy} onClick={validate}>{busy ? "…" : t("ex.validate")}</button>
        </div>
      )}

      {phase === "feedback" && (
        <div className="stack pt-reveal">
          {exercise.type === "multi" && (
            <span className={`hf-pill ${isCorrect ? "hf-pill--mint" : "hf-pill--orange"}`} style={{ alignSelf: "flex-start" }}>{isCorrect ? t("ex.correct") : t("ex.review")}</span>
          )}
          <div className="hf-card hf-card--mint">
            <strong className="ok">{t("ex.feedback")}</strong>
            <p className="body" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{exercise.feedbackText}</p>
          </div>
          <button className="hf-btn hf-btn--primary hf-btn--block" onClick={onNext}>{t("ex.next")}</button>
        </div>
      )}
    </div>
  );
}
