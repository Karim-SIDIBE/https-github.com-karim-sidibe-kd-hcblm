import { useEffect, useMemo, useState } from "react";
import { api, engine, store } from "../lib/app";
import { setCachedProgress } from "../lib/cache";
import { navigate, routes } from "../lib/router";
import { assessText, assessmentReason } from "../lib/textcheck";
import { useT, useI18n } from "../lib/i18n";

type Rubric = { criteria: { label: string; weightPoints: number }[]; threshold: number };
type SectionState = { key: string; title: string; helpText?: string; auto: boolean; done: boolean; text: string; locked: boolean };
type ProjectState = { sections: SectionState[]; journal: { day: number; done: boolean; unlocksAt: string | null; unlocked: boolean }[]; journalStartedAt: string | null; finalSectionKey: string };

/**
 * Block 4 certification project — PROGRESSIVE (consigne « Amélioration ») :
 * sections 1–3 are submitted one by one, Section 4 is greyed and auto-composed
 * from the six journal micro-entries, and Section 5 unlocks last — submitting
 * it assembles the whole project for the human evaluator. The rubric stays
 * visible BEFORE submission; afterwards the in-platform lifecycle shows.
 */
export function Project({ eid }: { eid: string }) {
  const t = useT();
  const { lang } = useI18n();
  const [bundle, setBundle] = useState<any>(null);
  const [status, setStatus] = useState<any | undefined>(undefined); // undefined=loading, null=not submitted
  const [state, setState] = useState<ProjectState | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    try { const p = await api.project(eid); setStatus(p ?? null); } catch { setStatus(null); }
    try {
      const st = await api.get<ProjectState>(`/enrollments/${eid}/project/state`);
      setState(st ?? null);
      if (st) setValues((v) => Object.fromEntries(st.sections.filter((s) => !s.auto).map((s) => [s.key, v[s.key] ?? s.text ?? ""])));
    } catch { /* offline */ }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      if (alive) setBundle(b);
      if (alive) await refresh();
    })();
    return () => { alive = false; };
  }, [eid]);

  const spec = useMemo(() => {
    const blk = bundle?.content?.blocks?.find((x: any) => x.type === "CERTIFICATION");
    if (!blk) return null;
    return { blockIndex: blk.index as number, brief: blk.payload.projectBrief as string, rubric: blk.payload.rubric as Rubric };
  }, [bundle]);

  async function submitSection(s: SectionState) {
    const text = (values[s.key] ?? "").trim();
    if (!text || s.locked || s.auto) return;
    setBusy(s.key);
    try {
      const r = await engine.commit(eid, "complete_item", { blockIndex: spec!.blockIndex, itemType: "PROJECT", itemKey: s.key, data: { text } });
      if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
      await refresh();
    } finally { setBusy(null); }
  }

  const Back = () => <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0 }} onClick={() => navigate(routes.cours(eid))}>{t("nav.backCourse")}</button>;
  if (!bundle || status === undefined) return <div className="stack"><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;
  if (!spec) return <div className="stack"><Back /><p className="banner offline">{t("pj.unavailable")}</p></div>;

  // --- already submitted → lifecycle status ---
  if (status) {
    const STATUS_FR: Record<string, string> = { SUBMITTED: t("pj.st.submitted"), ASSIGNED: t("pj.st.assigned"), PASSED: t("pj.st.passed"), REVISION_REQUESTED: t("pj.st.revision"), NOT_CERTIFIED: t("pj.st.notCertified") };
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

  // --- progressive submission (rubric shown BEFORE submit) ---
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

      {(state?.sections ?? []).map((s, i) => {
        const isFinal = s.key === state?.finalSectionKey;
        const text = values[s.key] ?? "";
        const quality = !s.auto && text.trim().length > 20 ? assessmentReason(assessText(text, { minWords: 5 }), t) : null;
        return (
          <div key={s.key} className="hf-card stack" style={s.locked || s.auto ? { opacity: s.locked ? 0.75 : 1 } : undefined}>
            <div className="row between" style={{ gap: 8 }}>
              <strong className="h4">{i + 1}. {s.title}</strong>
              {s.done && <span className="hf-pill hf-pill--mint hf-pill--sm">{t("pj.sectionDone")}</span>}
            </div>
            {s.helpText && <p className="meta" style={{ margin: 0 }}>{s.helpText}</p>}

            {s.auto ? (
              // Section 4 : greyed — auto-composed from the journal entries.
              <>
                <p className="meta" style={{ margin: 0 }}>{t("pj.section4Auto")}</p>
                <textarea className="hf-field" value={s.text || t("pj.section4Waiting")} disabled readOnly
                  style={{ minHeight: 110, background: "var(--bg-soft)", color: "var(--fg-2)" }} />
              </>
            ) : s.locked ? (
              <p className="meta" style={{ margin: 0 }}>{t("pj.sectionLocked")}</p>
            ) : (
              <>
                <textarea className="hf-field" spellCheck lang="fr" value={text} onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))} style={{ minHeight: 110 }}
                  onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
                {quality && <p className="meta" style={{ margin: 0, color: "var(--danger, #b45309)" }}>{quality}</p>}
                {isFinal && <p className="meta" style={{ margin: 0 }}>{t("pj.finalNote")}</p>}
                <button className={`hf-btn hf-btn--block ${isFinal ? "hf-btn--primary" : "hf-btn--outline"}`} style={{ marginTop: 2 }} disabled={busy === s.key || text.trim().length <= 20 || Boolean(quality)}
                  onClick={() => void submitSection(s)}>
                  {busy === s.key ? "…" : isFinal ? t("pj.submit") : t("pj.submitSection")}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
