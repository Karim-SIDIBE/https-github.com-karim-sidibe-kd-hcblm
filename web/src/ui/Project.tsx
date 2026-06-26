import { useEffect, useMemo, useState } from "react";
import { api, engine, store } from "../lib/app";
import { setCachedProgress } from "../lib/cache";
import { navigate, routes } from "../lib/router";
import { useT, useI18n } from "../lib/i18n";

type Rubric = { criteria: { label: string; weightPoints: number }[]; threshold: number };

/**
 * Block 4 certification project (§6.3). The rubric is shown to the learner
 * BEFORE submission; the 5 project sections are derived from their PAM. After
 * submission the screen shows the in-platform lifecycle status (assignment →
 * evaluation → result), with no e-mail step. hf-* kit.
 */
export function Project({ eid }: { eid: string }) {
  const t = useT();
  const { lang } = useI18n();
  const [bundle, setBundle] = useState<any>(null);
  const [status, setStatus] = useState<any | undefined>(undefined); // undefined=loading, null=not submitted
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      if (alive) setBundle(b);
      try { const p = await api.project(eid); if (alive) setStatus(p ?? null); }
      catch { if (alive) setStatus(null); }
    })();
    return () => { alive = false; };
  }, [eid]);

  const spec = useMemo(() => {
    const blk = bundle?.content?.blocks?.find((x: any) => x.type === "CERTIFICATION");
    if (!blk) return null;
    return { brief: blk.payload.projectBrief as string, sections: blk.payload.sections as { title: string; helpText: string }[], rubric: blk.payload.rubric as Rubric };
  }, [bundle]);

  const complete = spec ? spec.sections.every((s) => (values[s.title] ?? "").trim().length > 20) : false;

  async function submit() {
    if (!complete) return;
    setBusy(true);
    try {
      const r = await engine.commit(eid, "complete_item", { blockIndex: 4, itemType: "PROJECT", itemKey: "project", data: { sections: values } });
      if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
      try { setStatus(await api.project(eid)); } catch { setStatus({ revisionStatus: "SUBMITTED" }); }
    } finally { setBusy(false); }
  }

  const Back = () => <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0 }} onClick={() => navigate(routes.cours(eid))}>{t("nav.backCourse")}</button>;
  if (!bundle || status === undefined) return <div className="stack"><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;
  if (!spec) return <div className="stack"><Back /><p className="banner offline">{t("pj.unavailable")}</p></div>;

  // --- already submitted → lifecycle status ---
  if (status) {
    const STATUS_FR: Record<string, string> = { SUBMITTED: t("pj.st.submitted"), ASSIGNED: t("pj.st.assigned"), PASSED: t("pj.st.passed"), REVISION_REQUESTED: t("pj.st.revision") };
    const pillCls = status.result === "PASS" ? "hf-pill--mint" : status.result === "FAIL" ? "hf-pill--orange" : "hf-pill--soft";
    return (
      <div className="stack">
        <Back />
        <div><div className="eyebrow">{t("pj.eyebrow")}</div><h1 style={{ marginTop: 6 }}>{t("pj.title")}</h1></div>
        <div className="hf-card stack">
          <span className={`hf-pill ${pillCls}`} style={{ alignSelf: "flex-start" }}>{STATUS_FR[status.revisionStatus] ?? status.revisionStatus}</span>
          {status.submittedAt && <p className="meta" style={{ margin: 0 }}>{t("pj.submittedOn", { date: new Date(status.submittedAt).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR") })}</p>}
          {status.evaluator && <p className="meta" style={{ margin: 0 }}>{t("pj.evaluator", { name: status.evaluator.name })}</p>}
          {status.scoreTotal != null && <p className="h4" style={{ margin: 0 }}>{t("pj.scoreLine", { score: status.scoreTotal })} <span className="meta">{t("pj.scoreThreshold", { threshold: spec.rubric.threshold })}</span></p>}
          {Array.isArray(status.criteria) && (
            <ul style={{ margin: 0, paddingLeft: 18 }} className="body">{status.criteria.map((c: any) => <li key={c.label}>{c.label} : {c.points}/{c.weightPoints}</li>)}</ul>
          )}
          {status.feedback && <div className="hf-card hf-card--mint"><strong className="h4">{t("pj.evalFeedback")}</strong><p className="body" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{status.feedback}</p></div>}
        </div>
      </div>
    );
  }

  // --- submission form (rubric shown BEFORE submit) ---
  return (
    <div className="stack">
      <Back />
      <div><div className="eyebrow">{t("pj.eyebrow")}</div><h1 style={{ marginTop: 6 }}>{t("pj.title")}</h1></div>

      <div className="hf-card hf-card--stripe-orange stack">
        <div className="hf-pam"><span className="tag">{t("mission")}</span><div className="quote" style={{ whiteSpace: "pre-wrap" }}>{spec.brief}</div></div>
      </div>

      <div className="hf-card hf-card--icy stack">
        <strong className="h4">{t("pj.rubricTitle")} <span className="meta" style={{ fontWeight: 400 }}>{t("pj.rubricNote")}</span></strong>
        <div className="stack" style={{ gap: 8 }}>
          {spec.rubric.criteria.map((c) => (
            <div key={c.label} className="row between"><span className="body">{c.label}</span><span className="hf-pill hf-pill--soft hf-pill--sm">{t("pj.pts", { n: c.weightPoints })}</span></div>
          ))}
        </div>
        <p className="meta" style={{ margin: 0 }}>{t("pj.passThreshold", { threshold: spec.rubric.threshold })}</p>
      </div>

      {spec.sections.map((s, i) => (
        <div key={s.title} className="hf-card stack">
          <strong className="h4">{i + 1}. {s.title}</strong>
          {s.helpText && <p className="meta" style={{ margin: 0 }}>{s.helpText}</p>}
          <textarea className="hf-field" value={values[s.title] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [s.title]: e.target.value }))} style={{ minHeight: 110 }}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
        </div>
      ))}
      <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy || !complete} onClick={submit}>{busy ? "…" : t("pj.submit")}</button>
      {!complete && <p className="meta" style={{ margin: 0 }}>{t("pj.complete5")}</p>}
    </div>
  );
}
