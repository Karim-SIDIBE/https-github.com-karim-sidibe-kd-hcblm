import { useEffect, useMemo, useState } from "react";
import { api, auth, type EvalQueueItem, type ProjectDetail } from "../lib/api";
import { avatarColor, initials, ago, useAsync } from "../lib/ui";

const STATUS: Record<string, { cls: string; label: string }> = {
  SUBMITTED: { cls: "pill--warn", label: "À attribuer" },
  ASSIGNED: { cls: "pill--info", label: "En évaluation" },
  PASSED: { cls: "pill--green", label: "Validé" },
  REVISION_REQUESTED: { cls: "pill--red", label: "Révision demandée" },
};

function GradeDrawer({ item, onClose, onDone }: { item: EvalQueueItem; onClose: () => void; onDone: () => void }) {
  const me = auth.user();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [points, setPoints] = useState<number[]>(() => (item.rubric?.criteria ?? []).map(() => 0));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"" | "assign" | "grade">("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { api.project(item.enrollmentId).then(setDetail).catch(() => setDetail(null)); }, [item.enrollmentId]);

  const crit = item.rubric?.criteria ?? [];
  const maxTotal = crit.reduce((s, c) => s + c.weightPoints, 0) || 100;
  const total = points.reduce((s, p) => s + p, 0);
  const pct = Math.round((total / maxTotal) * 100);
  const threshold = item.rubric?.threshold ?? 70;
  const sections = detail?.content?.sections ?? {};

  async function assignSelf() {
    if (!me) return;
    setBusy("assign"); setMsg(null);
    try { await api.assignEvaluator(item.enrollmentId, me.id); setMsg("Projet attribué."); onDone(); } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(""); }
  }
  async function grade() {
    setBusy("grade"); setMsg(null);
    try {
      await api.gradeProject(item.enrollmentId, { criteria: points.map((p, i) => ({ index: i, points: p })), notes: notes.trim() || undefined });
      setMsg(`Note enregistrée : ${pct}% (${pct >= threshold ? "validé" : "révision demandée"}).`);
      onDone();
    } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(""); }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="dh">
          <div>
            <div className="eyebrow">Projet Bloc 4</div>
            <h2>{item.learner.name}</h2>
            <span className="muted" style={{ fontSize: 12.5 }}>{item.learner.email} · soumis {ago(item.submittedAt).toLowerCase()}</span>
          </div>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="db">
          <div className="row between" style={{ marginBottom: 14 }}>
            <span className={`pill ${(STATUS[item.revisionStatus] ?? { cls: "pill--soft" }).cls}`}>{(STATUS[item.revisionStatus] ?? { label: item.revisionStatus }).label}</span>
            {item.evaluator ? <span className="muted" style={{ fontSize: 12.5 }}>Évaluateur : {item.evaluator.name}</span>
              : <button className="btn btn--sm" disabled={busy === "assign"} onClick={assignSelf}>{busy === "assign" ? "…" : "M'attribuer ce projet"}</button>}
          </div>

          <div className="eyebrow" style={{ marginBottom: 8 }}>Copie de l'apprenant</div>
          {Object.keys(sections).length === 0 ? <p className="muted" style={{ fontSize: 13 }}>{detail ? "Aucune section." : "Chargement…"}</p>
            : Object.entries(sections).map(([title, body]) => (
              <div className="section" key={title}><h4>{title}</h4><p>{body}</p></div>
            ))}

          <div className="eyebrow" style={{ margin: "20px 0 6px" }}>Grille d'évaluation</div>
          {crit.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Grille indisponible.</p> : (<>
            {crit.map((c, i) => (
              <div className="crit" key={c.label}>
                <div className="lab">{c.label}<small>sur {c.weightPoints} points</small></div>
                <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                  <input type="number" min={0} max={c.weightPoints} value={points[i]}
                    onChange={(e) => setPoints((p) => p.map((v, j) => j === i ? Math.max(0, Math.min(c.weightPoints, Number(e.target.value) || 0)) : v))} />
                  <span className="max">/ {c.weightPoints}</span>
                </div>
              </div>
            ))}
            <div className="gradetotal">
              <span>Total · seuil {threshold}%</span>
              <span style={{ color: pct >= threshold ? "var(--success)" : "var(--danger)" }}><b className="num">{pct}%</b> ({total}/{maxTotal})</span>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Retour à l'apprenant (facultatif)…"
              style={{ width: "100%", marginTop: 12, padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 9, fontFamily: "inherit", fontSize: 13, minHeight: 80, resize: "vertical" }} />
          </>)}
          {msg && <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--navy-600)" }}>{msg}</p>}
        </div>
        <div className="df">
          <button className="btn" onClick={onClose}>Fermer</button>
          <button className="btn btn--primary" disabled={busy === "grade" || crit.length === 0} onClick={grade}>{busy === "grade" ? "…" : "Enregistrer la note"}</button>
        </div>
      </aside>
    </>
  );
}

export function Evaluation() {
  const { data, loading, error, reload } = useAsync<EvalQueueItem[]>(() => api.evaluations(), []);
  const [sel, setSel] = useState<EvalQueueItem | null>(null);
  const [filter, setFilter] = useState("À traiter");

  const rows = useMemo(() => (data ?? []).filter((i) =>
    filter === "Tous" || (filter === "À traiter" && (i.revisionStatus === "SUBMITTED" || i.revisionStatus === "ASSIGNED")) || (filter === "Validés" && i.revisionStatus === "PASSED")
  ), [data, filter]);
  const pending = (data ?? []).filter((i) => i.revisionStatus === "SUBMITTED" || i.revisionStatus === "ASSIGNED").length;

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Certification · {pending} à traiter</div>
          <h1>Projets Bloc 4</h1>
          <div className="sub">File d'évaluation des projets de certification — notez à la grille.</div>
        </div>
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}><option>À traiter</option><option>Validés</option><option>Tous</option></select>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Apprenant</th><th>Parcours</th><th>Soumis</th><th>Évaluateur</th><th>Score</th><th>Statut</th></tr></thead>
            <tbody>
              {rows.map((i) => {
                const st = STATUS[i.revisionStatus] ?? { cls: "pill--soft", label: i.revisionStatus };
                return (
                  <tr key={i.enrollmentId} onClick={() => setSel(i)}>
                    <td><div className="uitem"><span className="av" style={{ background: avatarColor(i.learner.name) }}>{initials(i.learner.name)}</span><div className="who"><b>{i.learner.name}</b><span>{i.learner.email}</span></div></div></td>
                    <td><span className="muted" style={{ fontSize: 12.5 }}>{i.courseTitle}</span></td>
                    <td><span style={{ fontSize: 12.5 }}>{ago(i.submittedAt)}</span></td>
                    <td>{i.evaluator ? <span style={{ fontSize: 12.5 }}>{i.evaluator.name}</span> : <span className="muted">— non attribué</span>}</td>
                    <td>{i.scoreTotal != null ? <span className="pill pill--soft">{i.scoreTotal}%</span> : <span className="muted">—</span>}</td>
                    <td><span className={`pill ${st.cls}`}><span className="dot" />{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && <div className="empty">Chargement de la file…</div>}
          {error && <div className="empty" style={{ color: "var(--danger)" }}>Erreur : {error}</div>}
          {!loading && !error && rows.length === 0 && <div className="empty"><div className="big">🎓</div>Aucun projet à évaluer pour ce filtre.</div>}
        </div>
      </div>

      {sel && <GradeDrawer item={sel} onClose={() => setSel(null)} onDone={() => { reload(); }} />}
    </div>
  );
}
