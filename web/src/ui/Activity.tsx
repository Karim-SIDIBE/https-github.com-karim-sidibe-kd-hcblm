import { useEffect, useMemo, useState } from "react";
import { engine, store } from "../lib/app";
import { getCachedProgress, setCachedProgress } from "../lib/cache";
import { goNext, nextTarget } from "../lib/nav";
import { navigate, routes } from "../lib/router";
import { Breadcrumb } from "./Breadcrumb";
import { useT, type TFn } from "../lib/i18n";

type Opt = { key: string; label: string };
type ScenarioStep = { question: string; options: Opt[]; correctKey: string; feedback: string };
type Scenario = { title: string; contextAfricain?: string; steps: ScenarioStep[] };
type CaseQuestion = {
  id: string; kind: "mcq" | "open"; prompt: string;
  options?: Opt[]; correctKey?: string; allValid?: boolean; feedback?: string;
  minChars?: number; savedForProject?: boolean;
};
type CaseStep = { title: string; durationEstimate?: string; intro?: string; questions: CaseQuestion[] };
type CaseSpec = {
  title: string; subtitle?: string; context?: string; durationEstimate?: string;
  steps: string[]; structuredSteps?: CaseStep[]; summary?: string[];
};

/**
 * Activity — the long-form block activities that are neither a video session
 * nor a quiz: guided scenarios (Bloc 2), self-assessment + 30-day action plan
 * (Bloc 3) and the case study (Bloc 1). Each renders REAL interactive content
 * from the cached bundle and commits a typed completion (offline-safe queue).
 */
export function Activity({ eid, block, itemKey }: { eid: string; block: number; itemKey: string }) {
  const t = useT();
  const [bundle, setBundle] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => { const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid)); if (alive) setBundle(b); })();
    return () => { alive = false; };
  }, [eid]);

  const blk = useMemo(() => bundle?.content?.blocks?.find((x: any) => x.index === block), [bundle, block]);

  async function complete(itemType: string, data: unknown): Promise<unknown> {
    const r = await engine.commit(eid, "complete_item", { blockIndex: block, itemType, itemKey, data });
    if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
    return (r as any).progress ?? null;
  }
  // Chaining: the activity's closing button launches the next element of the
  // parcours (e.g. mises en situation → quiz interbloc, cas Sylvie → auto-éval).
  const advance = (progressAfter?: unknown) =>
    goNext(eid, nextTarget(bundle?.content, (progressAfter as any) ?? getCachedProgress(eid), block, itemKey, t));
  const backToCourse = () => navigate(routes.cours(eid));
  const Back = () => <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0 }} onClick={backToCourse}>{t("nav.backCourse")}</button>;

  if (!bundle) return <div className="stack"><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;

  const p = blk?.payload ?? {};
  // The "case" key resolves to the Bloc 1 study OR the Bloc 3 transversal case.
  const caseSpec: CaseSpec | null = itemKey === "case" ? (p.caseStudy ?? p.transversalCase ?? null) : null;
  let body: JSX.Element | null = null;
  if (itemKey === "scenarios" && p.guidedScenarios?.length) {
    body = <Scenarios t={t} title={p.guidedScenariosTitle || t("ci.scenarios")} scenarios={p.guidedScenarios} onFinish={async (d) => { await complete("GUIDED_SCENARIOS", d); }} onClose={() => advance()} />;
  } else if (itemKey === "self" && p.selfAssessment) {
    body = <SelfAssessment t={t} title={p.selfAssessment.title || t("ci.self")} criteria={p.selfAssessment.criteria} scale={p.selfAssessment.scale} onFinish={async (d) => { advance(await complete("SELF_ASSESSMENT", d)); }} />;
  } else if (itemKey === "plan" && p.actionPlan30d) {
    body = <ActionPlan t={t} title={p.actionPlan30d.title || t("ci.plan")} intro={p.actionPlan30d.intro || ""} habits={p.actionPlan30d.habits} onFinish={async (d) => { advance(await complete("ACTION_PLAN", d)); }} />;
  } else if (caseSpec && (caseSpec.structuredSteps?.length ?? 0) > 0) {
    body = <StructuredCase t={t} caseStudy={caseSpec} onFinish={(d) => complete("CASE_STUDY", d)} onClose={() => advance()} />;
  } else if (caseSpec) {
    body = <CaseStudy t={t} caseStudy={caseSpec as { title: string; steps: string[] }} onFinish={async (d) => { advance(await complete("CASE_STUDY", d)); }} />;
  }

  if (!body) return <div className="stack"><Back /><p className="banner offline">{t("dl.notFound")}</p></div>;
  return <div className="stack"><Breadcrumb eid={eid} block={blk} itemKey={itemKey} />{body}</div>;
}

/** Guided scenarios: one situation at a time, immediate feedback per step. */
function Scenarios({ t, title, scenarios, onFinish, onClose }: {
  t: TFn; title: string; scenarios: Scenario[];
  onFinish: (data: unknown) => Promise<void>; onClose: () => void;
}) {
  const steps = useMemo(() => scenarios.flatMap((sc, si) => sc.steps.map((st, j) => ({ sc, st, first: j === 0, key: `s${si + 1}q${j + 1}` }))), [scenarios]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<"answer" | "feedback" | "done">("answer");
  const [busy, setBusy] = useState(false);

  const cur = steps[idx]!;
  const chosen = answers[cur.key] ?? "";
  const correctCount = steps.filter((s) => answers[s.key] === s.st.correctKey).length;

  async function next() {
    if (idx + 1 < steps.length) { setIdx(idx + 1); setPhase("answer"); return; }
    setBusy(true);
    try {
      await onFinish({ answers, correct: correctCount, total: steps.length });
      setPhase("done");
    } finally { setBusy(false); }
  }

  if (phase === "done") {
    return (
      <div className="hf-card center stack pt-reveal">
        <p style={{ fontSize: 44, margin: 0 }}>🧩</p>
        <h2>{t("act.scenarioDone")}</h2>
        <span className="hf-pill hf-pill--mint" style={{ alignSelf: "center" }}>{t("qz.correctCount", { correct: correctCount, total: steps.length })}</span>
        <button className="hf-btn hf-btn--primary hf-btn--block" onClick={onClose}>{t("common.continue")}</button>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>{title}</h1>
      <div className="hf-card stack">
        <div className="row between"><span className="eyebrow">{t("act.scenarioOf", { n: idx + 1, total: steps.length })}</span></div>
        <div className="hf-prog"><i style={{ width: `${((idx + (phase === "feedback" ? 1 : 0)) / steps.length) * 100}%` }} /></div>
        <strong className="h4">{cur.sc.title}</strong>
        {cur.first && cur.sc.contextAfricain && (
          <div className="hf-card hf-card--icy"><div className="eyebrow">{t("act.scenarioContext")}</div><p className="body" style={{ margin: "6px 0 0" }}>{cur.sc.contextAfricain}</p></div>
        )}
        <p className="h4" style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>{cur.st.question}</p>
        <div className="stack">
          {cur.st.options.map((o) => {
            const sel = chosen === o.key;
            const isRight = phase === "feedback" && o.key === cur.st.correctKey;
            const isWrong = phase === "feedback" && sel && !isRight;
            return (
              <div key={o.key} className={`pt-opt ${sel ? "sel" : ""} ${isWrong ? "ko" : ""}`} role="button"
                style={{ opacity: phase === "feedback" && !isRight && !sel ? 0.55 : 1, cursor: phase === "answer" ? "pointer" : "default" }}
                onClick={() => { if (phase === "answer") setAnswers((a) => ({ ...a, [cur.key]: o.key })); }}>
                <span className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                  <span className="hf-pill hf-pill--soft hf-pill--sm">{o.key}</span>
                  <span className="body" style={{ color: "var(--fg-1)" }}>{o.label}{isRight ? " ✅" : ""}{isWrong ? " ❌" : ""}</span>
                </span>
              </div>
            );
          })}
        </div>
        {phase === "answer" && <button className="hf-btn hf-btn--primary hf-btn--block" disabled={!chosen} onClick={() => setPhase("feedback")}>{t("quiz.validate")}</button>}
        {phase === "feedback" && (
          <div className="stack pt-reveal">
            <span className={`hf-pill ${chosen === cur.st.correctKey ? "hf-pill--mint" : "hf-pill--orange"}`} style={{ alignSelf: "flex-start" }}>{chosen === cur.st.correctKey ? t("quiz.good") : t("quiz.review")}</span>
            <div className="hf-card hf-card--mint"><p className="body" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{cur.st.feedback}</p></div>
            <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy} onClick={() => void next()}>{busy ? "…" : idx + 1 < steps.length ? t("quiz.nextQuestion") : t("quiz.seeResult")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Self-assessment: one honest rating per criterion, no right/wrong. */
function SelfAssessment({ t, title, criteria, scale, onFinish }: {
  t: TFn; title: string; criteria: string[]; scale: string[];
  onFinish: (data: unknown) => Promise<void>;
}) {
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const allDone = criteria.every((c) => ratings[c]);

  async function submit() {
    setBusy(true);
    try { await onFinish({ ratings: criteria.map((c) => ({ criterion: c, level: ratings[c] })) }); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <h1>{title}</h1>
      <div className="hf-card hf-card--icy"><p className="body" style={{ margin: 0 }}>{t("act.selfIntro")}</p></div>
      {criteria.map((c) => (
        <div key={c} className="hf-card stack">
          <strong className="h4">{c}</strong>
          <div className="stack" style={{ gap: 6 }}>
            {scale.map((s) => (
              <div key={s} className={`pt-opt ${ratings[c] === s ? "sel" : ""}`} role="button" onClick={() => setRatings((r) => ({ ...r, [c]: s }))}>
                <span className="body" style={{ color: "var(--fg-1)" }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button className="hf-btn hf-btn--primary hf-btn--block" disabled={!allDone || busy} onClick={() => void submit()}>{busy ? "…" : t("dl.submit")}</button>
    </div>
  );
}

/** 30-day action plan: the learner writes each habit's concrete anchoring. */
function ActionPlan({ t, title, intro, habits, onFinish }: {
  t: TFn; title: string; intro?: string; habits: { title: string; fields: string[] }[];
  onFinish: (data: unknown) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const vkey = (hi: number, f: string) => `${hi}:${f}`;
  const allDone = habits.every((h, hi) => h.fields.every((f) => (values[vkey(hi, f)] ?? "").trim().length > 0));

  async function submit() {
    setBusy(true);
    try {
      const data = { habits: habits.map((h, hi) => ({ title: h.title, values: Object.fromEntries(h.fields.map((f) => [f, (values[vkey(hi, f)] ?? "").trim()])) })) };
      await onFinish(data);
    } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <h1>{title}</h1>
      <div className="hf-card hf-card--icy"><p className="body" style={{ margin: 0 }}>{intro || t("act.planIntro")}</p></div>
      {habits.map((h, hi) => (
        <div key={h.title} className="hf-card hf-card--stripe-orange stack">
          <strong className="h4">{h.title}</strong>
          {h.fields.map((f) => (
            <label key={f}>{f}
              <input className="hf-field" value={values[vkey(hi, f)] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [vkey(hi, f)]: e.target.value }))}
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
            </label>
          ))}
        </div>
      ))}
      <button className="hf-btn hf-btn--primary hf-btn--block" disabled={!allDone || busy} onClick={() => void submit()}>{busy ? "…" : t("dl.submit")}</button>
    </div>
  );
}

/**
 * Structured case study (énoncé complet) — context card, then one question at a
 * time across the étapes: MCQ with immediate feedback (A–D, « allValid » profile
 * questions never marked wrong) and open reflections (saved for the Bloc 4
 * certification project). Ends with the « résumé des apprentissages clés ».
 */
function StructuredCase({ t, caseStudy, onFinish, onClose }: {
  t: TFn; caseStudy: CaseSpec;
  onFinish: (data: unknown) => Promise<unknown>; onClose: () => void;
}) {
  const steps = caseStudy.structuredSteps ?? [];
  const flat = useMemo(
    () => steps.flatMap((st, si) => st.questions.map((q, qi) => ({ st, si, q, first: qi === 0 }))),
    [steps],
  );
  const [idx, setIdx] = useState(-1); // -1 = context screen
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<"answer" | "feedback" | "done">("answer");
  const [busy, setBusy] = useState(false);

  const total = flat.length;
  const cur = idx >= 0 ? flat[idx] : undefined;
  const chosen = cur ? (answers[cur.q.id] ?? "") : "";
  const mcqs = flat.filter((f) => f.q.kind === "mcq" && !f.q.allValid);
  const correctCount = mcqs.filter((f) => answers[f.q.id] === f.q.correctKey).length;

  const canValidate = cur
    ? cur.q.kind === "mcq" ? chosen !== "" : chosen.trim().length >= (cur.q.minChars ?? 20)
    : false;

  async function next() {
    if (idx + 1 < total) { setIdx(idx + 1); setPhase("answer"); return; }
    setBusy(true);
    try {
      const open = Object.fromEntries(flat.filter((f) => f.q.kind === "open").map((f) => [f.q.id, (answers[f.q.id] ?? "").trim()]));
      await onFinish({ answers, open, correct: correctCount, total: mcqs.length });
      setPhase("done");
    } finally { setBusy(false); }
  }

  if (phase === "done") {
    return (
      <div className="stack">
        <div className="hf-card center stack pt-reveal">
          <p style={{ fontSize: 44, margin: 0 }}>📋</p>
          <h2>{t("act.caseDone")}</h2>
          {mcqs.length > 0 && <span className="hf-pill hf-pill--mint" style={{ alignSelf: "center" }}>{t("qz.correctCount", { correct: correctCount, total: mcqs.length })}</span>}
        </div>
        {(caseStudy.summary?.length ?? 0) > 0 && (
          <div className="hf-card hf-card--mint stack">
            <strong className="h4">{t("act.caseSummary")}</strong>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{caseStudy.summary!.map((s, i) => <li key={i} className="body">{s}</li>)}</ul>
          </div>
        )}
        <button className="hf-btn hf-btn--primary hf-btn--block" onClick={onClose}>{t("common.continue")}</button>
      </div>
    );
  }

  if (idx === -1) {
    return (
      <div className="stack">
        <div><div className="eyebrow">{caseStudy.title}</div><h1 style={{ marginTop: 6 }}>{caseStudy.subtitle || caseStudy.title}</h1></div>
        {caseStudy.context && (
          <div className="hf-card hf-card--icy"><div className="eyebrow">{t("act.caseContext")}</div><p className="body" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{caseStudy.context}</p></div>
        )}
        <div className="hf-card stack">
          {steps.map((st, i) => (
            <div key={i} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <span className="hf-medal cert" style={{ width: 30, height: 30, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
              <span className="body">{st.title}{st.durationEstimate ? <span className="meta"> · {st.durationEstimate}</span> : null}</span>
            </div>
          ))}
        </div>
        <button className="hf-btn hf-btn--primary hf-btn--block" onClick={() => setIdx(0)}>{t("common.continue")}</button>
      </div>
    );
  }

  const isCorrect = cur!.q.allValid || chosen === cur!.q.correctKey;
  return (
    <div className="stack">
      <h1>{caseStudy.subtitle || caseStudy.title}</h1>
      <div className="hf-card stack">
        <div className="row between">
          <span className="eyebrow">{cur!.st.title}</span>
          <span className="meta" style={{ whiteSpace: "nowrap" }}>{t("act.caseStepOf", { n: cur!.si + 1, total: steps.length })}</span>
        </div>
        <div className="hf-prog"><i style={{ width: `${((idx + (phase === "feedback" ? 1 : 0)) / total) * 100}%` }} /></div>
        {cur!.first && cur!.st.intro && <div className="hf-card hf-card--icy"><p className="body" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{cur!.st.intro}</p></div>}
        <p className="h4" style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>{cur!.q.prompt}</p>

        {cur!.q.kind === "mcq" && (
          <div className="stack">
            {cur!.q.allValid && phase === "answer" && <div className="meta">{t("act.caseAllValid")}</div>}
            {(cur!.q.options ?? []).map((o) => {
              const sel = chosen === o.key;
              const isRight = phase === "feedback" && !cur!.q.allValid && o.key === cur!.q.correctKey;
              const isWrong = phase === "feedback" && !cur!.q.allValid && sel && !isRight;
              return (
                <div key={o.key} className={`pt-opt ${sel ? "sel" : ""} ${isWrong ? "ko" : ""}`} role="button"
                  style={{ opacity: phase === "feedback" && !isRight && !sel ? 0.55 : 1, cursor: phase === "answer" ? "pointer" : "default" }}
                  onClick={() => { if (phase === "answer") setAnswers((a) => ({ ...a, [cur!.q.id]: o.key })); }}>
                  <span className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                    <span className="hf-pill hf-pill--soft hf-pill--sm">{o.key}</span>
                    <span className="body" style={{ color: "var(--fg-1)" }}>{o.label}{isRight ? " ✅" : ""}{isWrong ? " ❌" : ""}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {cur!.q.kind === "open" && (
          <div className="hf-textwrap">
            <textarea className="hf-field" value={chosen} disabled={phase !== "answer"} placeholder={t("act.openAnswerPh")} style={{ minHeight: 130 }}
              onChange={(e) => setAnswers((a) => ({ ...a, [cur!.q.id]: e.target.value }))}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
            <span className="hf-count" style={{ color: canValidate ? "var(--brand-declick)" : undefined }}>{chosen.trim().length} / {cur!.q.minChars ?? 20}</span>
          </div>
        )}

        {phase === "answer" && <button className="hf-btn hf-btn--primary hf-btn--block" disabled={!canValidate} onClick={() => setPhase("feedback")}>{t("quiz.validate")}</button>}
        {phase === "feedback" && (
          <div className="stack pt-reveal">
            {cur!.q.kind === "mcq" && (
              <span className={`hf-pill ${cur!.q.allValid ? "hf-pill--mint" : isCorrect ? "hf-pill--mint" : "hf-pill--orange"}`} style={{ alignSelf: "flex-start" }}>
                {cur!.q.allValid ? t("quiz.profileSaved") : isCorrect ? t("quiz.good") : t("quiz.review")}
              </span>
            )}
            {cur!.q.feedback && <div className="hf-card hf-card--mint"><p className="body" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{cur!.q.feedback}</p></div>}
            {cur!.q.kind === "open" && cur!.q.savedForProject && <div className="meta">{t("act.caseSaved")}</div>}
            <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy} onClick={() => void next()}>{busy ? "…" : idx + 1 < total ? t("quiz.nextQuestion") : t("quiz.seeResult")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Case study: guided steps + a written transfer analysis (min 150 chars). */
function CaseStudy({ t, caseStudy, onFinish }: {
  t: TFn; caseStudy: { title: string; steps: string[] };
  onFinish: (data: unknown) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const MIN = 150;
  const ok = text.trim().length >= MIN;

  async function submit() {
    setBusy(true);
    try { await onFinish({ text: text.trim(), steps: caseStudy.steps.length }); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <div><div className="eyebrow">{t("ci.case")}</div><h1 style={{ marginTop: 6 }}>{caseStudy.title}</h1></div>
      <div className="hf-card hf-card--icy"><p className="body" style={{ margin: 0 }}>{t("act.caseIntro")}</p></div>
      {caseStudy.steps.map((s, i) => (
        <div key={i} className="hf-card row" style={{ gap: 12, alignItems: "flex-start" }}>
          <span className="hf-medal cert" style={{ width: 32, height: 32, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
          <p className="body" style={{ margin: 0 }}>{s}</p>
        </div>
      ))}
      <div className="hf-card hf-card--stripe-orange stack">
        <strong className="h4">{t("act.caseAnswer")}</strong>
        <div className="hf-textwrap">
          <textarea className="hf-field" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("answerPlaceholder")} style={{ minHeight: 160 }}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
          <span className="hf-count" style={{ color: ok ? "var(--brand-declick)" : undefined }}>{text.trim().length} / {MIN}</span>
        </div>
        <button className="hf-btn hf-btn--primary hf-btn--block" disabled={!ok || busy} onClick={() => void submit()}>{busy ? "…" : t("dl.submit")}</button>
      </div>
    </div>
  );
}
