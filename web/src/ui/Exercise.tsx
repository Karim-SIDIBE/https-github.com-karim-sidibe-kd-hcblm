import { useRef, useState } from "react";
import type { Exercise as ExerciseSpec } from "@kd/shared";

export type { ExerciseSpec };
export type ExerciseMeta = { timeMs: number; feedbackViewed: boolean; response?: string; correct?: boolean };

/**
 * Exercise — the interactive exercise shown immediately after the video (§5.1).
 * It is the completion gate: the learner cannot advance until they answer and
 * read the feedback. Emits xAPI meta (time-on-exercise, feedback-viewed,
 * response, correctness) for question-level logging (AC#11).
 */
export function Exercise({ exercise, onComplete }: { exercise: ExerciseSpec; onComplete: (data: unknown, meta: ExerciseMeta) => void | Promise<void> }) {
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

  async function finish() {
    setBusy(true);
    const correct = exercise.type === "multi" ? choice === exercise.correctKey : undefined;
    const meta: ExerciseMeta = { timeMs: Date.now() - start.current, feedbackViewed: true, response: response(), correct };
    const data =
      exercise.type === "multi" ? { choice } :
      exercise.type === "written" ? { text: text.trim() } :
      { fields: values };
    try { await onComplete(data, meta); } finally { setBusy(false); }
  }

  const isCorrect = exercise.type === "multi" && choice === exercise.correctKey;

  return (
    <div className="card">
      <h3>Exercice</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{exercise.prompt}</p>

      {phase === "answer" && (
        <div className="stack">
          {exercise.type === "multi" && (exercise.options ?? []).map((o) => (
            <label key={o.key} className="row" style={{ margin: 0, alignItems: "flex-start", gap: 8 }}>
              <input type="radio" name="opt" style={{ width: "auto", marginTop: 4 }} checked={choice === o.key} onChange={() => setChoice(o.key)} />
              <span><strong>{o.key}.</strong> {o.label}</span>
            </label>
          ))}

          {exercise.type === "written" && (
            <>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Votre réponse…"
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
              <p className={`muted ${text.trim().length >= minChars ? "ok" : ""}`} style={{ margin: 0, fontSize: 13 }}>
                {text.trim().length} / {minChars} caractères minimum
              </p>
            </>
          )}

          {exercise.type === "guidedForm" && (exercise.fields ?? []).map((f) => (
            <label key={f.label}>{f.label}
              <input value={values[f.label] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))}
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
            </label>
          ))}

          <button className="block" disabled={!canAnswer} onClick={() => setPhase("feedback")}>Valider ma réponse</button>
        </div>
      )}

      {phase === "feedback" && (
        <div className="stack">
          {exercise.type === "multi" && (
            <p className={`chip ${isCorrect ? "ok" : "ko"}`}>{isCorrect ? "Bonne réponse ✅" : "Réponse à revoir"}</p>
          )}
          <div className="banner syncing" style={{ display: "block" }}>
            <strong>Feedback</strong>
            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{exercise.feedbackText}</p>
          </div>
          <button className="block" disabled={busy} onClick={finish}>{busy ? "…" : "Continuer →"}</button>
        </div>
      )}
    </div>
  );
}
