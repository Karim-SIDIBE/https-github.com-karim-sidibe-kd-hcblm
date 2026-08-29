import { useEffect, useRef, useState } from "react";
import type { Exercise as ExerciseSpec } from "@kd/shared";
import { assessText, assessmentReason, fieldExpectsNumber } from "../lib/textcheck";
import { clearDraft, loadDraft, useDraft } from "../lib/draft";
import { useT } from "../lib/i18n";

export type { ExerciseSpec };
export type ExerciseMeta = { timeMs: number; feedbackViewed: boolean; response?: string; correct?: boolean };

/**
 * Exercise — the interactive exercise shown immediately after the video (§5.1),
 * styled to the Declick prototype (peach "Moment d'Ancrage" prompt, option cards,
 * green feedback). It is the completion gate: the learner cannot advance until
 * they answer and read the feedback. Emits xAPI meta (AC#11).
 */
export function Exercise({ exercise, onComplete, onNext, aiFeedback, frozen, draftKey }: {
  exercise: ExerciseSpec;
  onComplete: (data: unknown, meta: ExerciseMeta) => void | Promise<void>;
  onNext: () => void;
  /** Optional: fetch a personalised (AI) feedback on the saved answer — shown
   *  in addition to the static feedback, silently skipped offline/on error. */
  aiFeedback?: () => Promise<string | null>;
  /** Recorded answer of an already-completed exercise: render it read-only
   *  (first submission is final — server-enforced). */
  frozen?: unknown;
  /** Clé de brouillon local (P3) — la saisie survit à un départ de l'écran. */
  draftKey?: string;
}) {
  const t = useT();
  const start = useRef(Date.now());
  const fz = frozen as { choice?: string; text?: string; fields?: Record<string, string> } | undefined;
  type Draft = { choice?: string; text?: string; fields?: Record<string, string> };
  const draft = fz ? null : loadDraft<Draft>(draftKey);
  const [phase, setPhase] = useState<"answer" | "feedback">(fz ? "feedback" : "answer");
  const [choice, setChoice] = useState<string>(fz?.choice ?? draft?.choice ?? "");
  const [text, setText] = useState(fz?.text ?? draft?.text ?? "");
  // Pré-remplissage serveur (drapeau prefillFromMomentAncrage du contenu) :
  // valeur initiale éditable, ignorée dès qu'une soumission existe. Le
  // brouillon local (ce que l'apprenant a déjà tapé) prime sur le prefill.
  const [values, setValues] = useState<Record<string, string>>(() => fz?.fields
    ?? { ...Object.fromEntries(((exercise.fields ?? []) as { label: string; prefill?: string }[])
      .filter((f) => f.prefill).map((f) => [f.label, f.prefill!])), ...(draft?.fields ?? {}) });
  useDraft(draftKey, { choice, text, fields: values }, phase === "answer" && !fz);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<{ loading: boolean; text: string | null }>({ loading: false, text: null });

  // Le feedback personnalisé (IA) d'origine est CONSERVÉ — serveur idempotent +
  // cache local. On le charge à chaque entrée en phase feedback : première
  // validation comme revisite d'un exercice figé (il oriente le parcours).
  useEffect(() => {
    if (phase !== "feedback" || !aiFeedback || ai.loading || ai.text != null) return;
    let alive = true;
    setAi({ loading: true, text: null });
    aiFeedback()
      .then((text) => { if (alive) setAi({ loading: false, text }); })
      .catch(() => { if (alive) setAi({ loading: false, text: null }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const minChars = exercise.minChars ?? 200;
  // Text-quality gate (3e point) : the button stays blocked WITH THE REASON
  // until every answer reads as real French/English (numbers where expected).
  const quality: string | null = (() => {
    if (exercise.type === "written") {
      if (text.trim().length < minChars) return null; // the counter already explains
      return assessmentReason(assessText(text, { minWords: 3 }), t);
    }
    if (exercise.type === "guidedForm") {
      for (const f of exercise.fields ?? []) {
        const v = (values[f.label] ?? "").trim();
        if (!v) continue;
        const r = assessmentReason(assessText(v, { requireNumber: fieldExpectsNumber(f.label, f.placeholder) }), t);
        if (r) return `${f.label} — ${r}`;
      }
      return null;
    }
    return null;
  })();
  const canAnswer = quality == null && (
    exercise.type === "multi" ? choice !== "" :
    exercise.type === "written" ? text.trim().length >= minChars :
    (exercise.fields ?? []).every((f) => (values[f.label] ?? "").trim().length > 0));

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
    // guidedForm : les champs sont enregistrés dans l'ORDRE DU CONTENU, pas
    // dans l'ordre de frappe — le feedback IA les commente par numéro (P4).
    const data = exercise.type === "multi" ? { choice } : exercise.type === "written" ? { text: text.trim() }
      : { fields: Object.fromEntries((exercise.fields ?? []).map((f) => [f.label, (values[f.label] ?? "").trim()])) };
    try { await onComplete(data, meta); clearDraft(draftKey); setPhase("feedback"); } finally { setBusy(false); }
    // The personalised feedback now loads via the phase effect above (shared
    // with frozen revisits). Best-effort: offline keeps static feedback only.
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
              <textarea className="hf-field" spellCheck lang="fr" value={text} onChange={(e) => setText(e.target.value)} placeholder={exercise.placeholder || t("answerPlaceholder")} style={{ minHeight: 150 }}
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
              <span className="hf-count" style={{ color: text.trim().length >= minChars ? "var(--brand-declick)" : undefined }}>{text.trim().length} / {minChars} {t("dl.unitChars")}</span>
            </div>
          )}
          {/* Retours de test (P1) : « 90 mots sur 200 » — le seuil est en
              CARACTÈRES, pas en mots. On l'écrit noir sur blanc tant que le
              minimum n'est pas atteint, au lieu d'un bouton gris muet. */}
          {exercise.type === "written" && text.trim().length > 0 && text.trim().length < minChars && (
            <p className="meta" style={{ margin: 0 }}>{t("tc.charsLeft", { n: minChars - text.trim().length })}</p>
          )}

          {exercise.type === "guidedForm" && (exercise.fields ?? []).map((f) => (
            <label key={f.label}>{f.label}
              <input className="hf-field" spellCheck lang="fr" value={values[f.label] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))}
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
            </label>
          ))}

          {quality && <p className="meta" style={{ margin: 0, color: "var(--danger, #b45309)" }}>{quality}</p>}
          <button className="hf-btn hf-btn--primary hf-btn--block" disabled={!canAnswer || busy} onClick={validate}>{busy ? "…" : t("ex.validate")}</button>
        </div>
      )}

      {phase === "feedback" && (
        <div className="stack pt-reveal">
          {fz && <div className="hf-card hf-card--icy"><p className="body" style={{ margin: 0 }}>🔒 {t("frz.note")}</p></div>}
          {exercise.type === "multi" && (
            <span className={`hf-pill ${isCorrect ? "hf-pill--mint" : "hf-pill--orange"}`} style={{ alignSelf: "flex-start" }}>{isCorrect ? t("ex.correct") : t("ex.review")}</span>
          )}
          {/* The recorded answer stays visible on every revisit. */}
          {exercise.type === "multi" && choice && (
            <div className="hf-card"><div className="eyebrow">{t("frz.yourAnswer")}</div><p className="body" style={{ margin: "6px 0 0" }}>
              <span className="hf-pill hf-pill--soft hf-pill--sm" style={{ marginRight: 8 }}>{choice}</span>
              {(exercise.options ?? []).find((o) => o.key === choice)?.label ?? ""}
            </p></div>
          )}
          {exercise.type === "written" && text && (
            <div className="hf-card"><div className="eyebrow">{t("frz.yourAnswer")}</div><p className="body" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{text}</p></div>
          )}
          {exercise.type === "guidedForm" && Object.keys(values).length > 0 && (
            <div className="hf-card stack" style={{ gap: 8 }}>
              <div className="eyebrow">{t("frz.yourAnswer")}</div>
              {(exercise.fields ?? []).map((f) => (
                <div key={f.label}><span className="meta">{f.label}</span><p className="body" style={{ margin: "2px 0 0" }}>{values[f.label] ?? "—"}</p></div>
              ))}
            </div>
          )}
          <div className="hf-card hf-card--mint">
            <strong className="ok">{t("ex.feedback")}</strong>
            <p className="body" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{exercise.feedbackText}</p>
          </div>
          {ai.loading && <p className="meta">✨ {t("ex.aiLoading")}</p>}
          {ai.text && (
            <div className="hf-card hf-card--icy">
              <div className="eyebrow">✨ {t("ex.aiTitle")}</div>
              <p className="body" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{ai.text}</p>
            </div>
          )}
          <button className="hf-btn hf-btn--primary hf-btn--block" onClick={onNext}>{t("ex.next")}</button>
        </div>
      )}
    </div>
  );
}
