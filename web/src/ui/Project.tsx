import { useEffect, useMemo, useState } from "react";
import { api, engine, store } from "../lib/app";
import { setCachedProgress } from "../lib/cache";
import { navigate, routes } from "../lib/router";

type Rubric = { criteria: { label: string; weightPoints: number }[]; threshold: number };

/**
 * Block 4 certification project (§6.3). The rubric is shown to the learner
 * BEFORE submission; the 5 project sections are derived from their PAM. After
 * submission the screen shows the in-platform lifecycle status (assignment →
 * evaluation → result), with no e-mail step.
 */
export function Project({ eid }: { eid: string }) {
  const [bundle, setBundle] = useState<any>(null);
  const [status, setStatus] = useState<any | undefined>(undefined); // undefined=loading, null=not submitted
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      if (alive) setBundle(b);
      try { const p = await api.project(eid); if (alive) setStatus(p); }
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

  const Back = () => <button className="ghost" onClick={() => navigate(routes.course(eid))}>← Tableau de bord</button>;
  if (!bundle || status === undefined) return <div><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;
  if (!spec) return <div><Back /><p className="banner offline">Projet indisponible.</p></div>;

  // --- already submitted → lifecycle status ---
  if (status) {
    const STATUS_FR: Record<string, string> = { SUBMITTED: "Soumis — en attente d'attribution", ASSIGNED: "En cours d'évaluation", PASSED: "Validé 🎓", REVISION_REQUESTED: "Révision demandée" };
    return (
      <div className="stack">
        <Back />
        <h1>Projet de certification</h1>
        <div className="card stack">
          <span className={`chip ${status.result === "PASS" ? "ok" : status.result === "FAIL" ? "ko" : "warn"}`} style={{ alignSelf: "flex-start" }}>
            {STATUS_FR[status.revisionStatus] ?? status.revisionStatus}
          </span>
          {status.submittedAt && <p className="muted" style={{ margin: 0 }}>Soumis le {new Date(status.submittedAt).toLocaleDateString("fr-FR")}</p>}
          {status.evaluator && <p className="muted" style={{ margin: 0 }}>Évaluateur : {status.evaluator.name}</p>}
          {status.scoreTotal != null && <p style={{ margin: 0 }}><strong>Score : {status.scoreTotal}/100</strong> (seuil {spec.rubric.threshold})</p>}
          {Array.isArray(status.criteria) && (
            <ul style={{ margin: 0, paddingLeft: 18 }}>{status.criteria.map((c: any) => <li key={c.label}>{c.label} : {c.points}/{c.weightPoints}</li>)}</ul>
          )}
          {status.feedback && <div className="banner syncing" style={{ display: "block" }}><strong>Retour de l'évaluateur</strong><p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{status.feedback}</p></div>}
        </div>
      </div>
    );
  }

  // --- submission form (rubric shown BEFORE submit) ---
  return (
    <div className="stack">
      <Back />
      <h1>Projet de certification</h1>
      <div className="card" style={{ background: "#eff6ff" }}><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{spec.brief}</p></div>

      <div className="card">
        <strong>Grille d'évaluation (visible avant de soumettre)</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {spec.rubric.criteria.map((c) => <li key={c.label}>{c.label} — <span className="muted">{c.weightPoints} pts</span></li>)}
        </ul>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>Seuil de réussite : {spec.rubric.threshold}/100</p>
      </div>

      {spec.sections.map((s, i) => (
        <div key={s.title} className="stack">
          <label style={{ margin: 0 }}>{i + 1}. {s.title}{s.helpText && <span className="muted" style={{ fontWeight: 400 }}> — {s.helpText}</span>}</label>
          <textarea value={values[s.title] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [s.title]: e.target.value }))} style={{ minHeight: 110 }}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
        </div>
      ))}
      <button className="block" disabled={busy || !complete} onClick={submit}>{busy ? "…" : "Soumettre mon projet"}</button>
      {!complete && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Complétez les 5 sections pour soumettre.</p>}
    </div>
  );
}
