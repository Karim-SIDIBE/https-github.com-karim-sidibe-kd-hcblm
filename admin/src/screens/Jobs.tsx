import { useEffect, useState } from "react";
import { api, type JobInfo, type JobRunRow } from "../lib/api";
import { ago } from "../lib/ui";
import { Pager } from "../lib/widgets";

/** Manual-run endpoint for each catalog key (bodies stay empty = defaults). */
const RUN_PATH: Record<string, string> = {
  "notifications": "/jobs/notifications/dispatch",
  "webhooks-flush": "/jobs/webhooks/flush",
  "lrs-forward": "/jobs/lrs/forward",
  "re-engagement": "/jobs/re-engagement/run",
  "journal-triggers": "/jobs/journal-triggers/run",
  "project-sla": "/jobs/project-sla/run",
  "insights-alerts": "/jobs/insights-alerts/run",
  "scheduled-reports": "/jobs/scheduled-reports/run",
  "retention": "/jobs/retention/run",
  "lrs-retention": "/jobs/lrs/retention",
};

const fmtDuration = (ms: number | null) => ms == null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
const fmtResult = (r: Record<string, unknown> | null) =>
  r ? Object.entries(r).filter(([, v]) => typeof v !== "object").map(([k, v]) => `${k}: ${v}`).join(" · ") : "";
const PAGE_SIZE = 20;

export function Jobs() {
  const [jobs, setJobs] = useState<JobInfo[] | null>(null);
  const [runs, setRuns] = useState<JobRunRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState(""); // job key filter for the history
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); // expanded run id

  async function load() {
    try {
      const [j, r] = await Promise.all([
        api.jobs(),
        api.jobRuns({ name: filter || undefined, page, pageSize: PAGE_SIZE }),
      ]);
      setJobs(j); setRuns(r.data); setTotal(r.total);
    } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); setJobs([]); setRuns([]); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [filter, page]);
  useEffect(() => { setPage(1); }, [filter]);

  async function run(j: JobInfo) {
    const path = RUN_PATH[j.key];
    if (!path) return;
    setBusy(j.key); setNote(null);
    try {
      const r = await api.runJobPath(path);
      setNote(`✅ « ${j.label} » exécuté : ${fmtResult(r) || "terminé"}.`);
      load();
    } catch (e) { setNote(e instanceof Error ? e.message : "Échec de l'exécution"); }
    finally { setBusy(null); }
  }

  const statusPill = (ok: boolean | null) =>
    ok === true ? <span className="pill pill--green"><span className="dot" />OK</span>
    : ok === false ? <span className="pill pill--red"><span className="dot" />Échec</span>
    : <span className="pill pill--soft">—</span>;

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{jobs ? `${jobs.length} jobs · planificateur interne` : "…"}</div>
          <h1>Jobs &amp; planification</h1>
          <div className="sub">Tâches de fond de la plateforme : dernier passage, résultat, exécution manuelle. Les files silencieuses (rien à faire) ne génèrent pas de ligne.</div>
        </div>
      </div>

      {note && <div className="card" style={{ background: note.startsWith("✅") ? "var(--success-tint)" : "var(--warning-tint)", border: "none", padding: "11px 14px", marginBottom: 14, fontSize: 13 }} onClick={() => setNote(null)}>{note}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Job</th><th>Cadence</th><th>Dernier passage</th><th>Durée</th><th>Statut</th><th>Résultat</th><th></th></tr></thead>
            <tbody>
              {(jobs ?? []).map((j) => (
                <tr key={j.key} style={{ cursor: "pointer" }} onClick={() => setFilter(filter === j.key ? "" : j.key)} title="Filtrer l'historique sur ce job">
                  <td><b style={{ fontSize: 13 }}>{j.label}</b><div className="muted" style={{ fontSize: 11.5, maxWidth: 380 }}>{j.description}</div></td>
                  <td><span className="pill pill--soft" style={{ fontSize: 11 }}>{j.cadence}</span></td>
                  <td>{j.lastRun ? <span style={{ fontSize: 12.5 }}>{ago(j.lastRun.startedAt)}<div className="muted" style={{ fontSize: 11 }}>{j.lastRun.trigger === "manual" ? "manuel" : "planifié"}</div></span> : <span className="muted">jamais</span>}</td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>{fmtDuration(j.lastRun?.durationMs ?? null)}</span></td>
                  <td>{statusPill(j.lastRun?.ok ?? null)}</td>
                  <td><span className="muted" style={{ fontSize: 11.5, maxWidth: 260, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.lastRun?.error ?? fmtResult(j.lastRun?.result ?? null)}>{j.lastRun?.error ?? fmtResult(j.lastRun?.result ?? null) ?? "—"}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn--sm btn--primary" disabled={busy === j.key} onClick={(e) => { e.stopPropagation(); void run(j); }}>{busy === j.key ? "…" : "▶ Exécuter"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!jobs && <div className="empty">Chargement…</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-h" style={{ paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
          <b style={{ fontSize: 13.5 }}>Historique des exécutions{filter ? ` — ${jobs?.find((j) => j.key === filter)?.label ?? filter}` : ""}</b>
          {filter && <button className="btn btn--sm" style={{ marginLeft: 10 }} onClick={() => setFilter("")}>✕ Tout l'historique</button>}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Quand</th><th>Job</th><th>Déclencheur</th><th>Durée</th><th>Statut</th><th>Détail</th></tr></thead>
            <tbody>
              {(runs ?? []).map((r) => (
                <tr key={r.id} onClick={() => setOpen(open === r.id ? null : r.id)} style={{ cursor: "pointer" }}>
                  <td><span style={{ fontSize: 12.5 }}>{ago(r.startedAt)}</span><div className="muted" style={{ fontSize: 11 }}>{new Date(r.startedAt).toLocaleTimeString("fr-FR")}</div></td>
                  <td><span className="pill pill--soft" style={{ fontSize: 11 }}>{jobs?.find((j) => j.key === r.name)?.label ?? r.name}</span></td>
                  <td><span className="muted" style={{ fontSize: 12 }}>{r.trigger === "manual" ? "manuel" : "planifié"}</span></td>
                  <td><span className="muted" style={{ fontSize: 12 }}>{r.finishedAt ? fmtDuration(new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) : "—"}</span></td>
                  <td>{statusPill(r.ok)}</td>
                  <td style={{ maxWidth: 420 }}>
                    {open === r.id
                      ? <pre style={{ fontSize: 11, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{r.error ?? JSON.stringify(r.result, null, 2)}</pre>
                      : <span className="muted" style={{ fontSize: 11.5, display: "inline-block", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.error ?? fmtResult(r.result)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs != null && runs.length === 0 && <div className="empty"><div className="big">⚙️</div>Aucune exécution enregistrée{filter ? " pour ce job" : ""}.</div>}
          {runs != null && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
        </div>
      </div>
    </div>
  );
}
