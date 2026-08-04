import { Fragment, useEffect, useState } from "react";
import { api, type AuditRow } from "../lib/api";
import { ago } from "../lib/ui";
import { downloadBlob } from "../lib/csv";
import { Pager, ViewsBar } from "../lib/widgets";

function actionPill(action: string) {
  const head = action.split(".")[0];
  const cls = head === "user" ? "pill--info" : head === "course" ? "pill--orange" : head === "auth" ? "pill--navy"
    : head === "credential" ? "pill--green" : head === "evaluation" ? "pill--warn" : "pill--soft";
  return <span className={`pill ${cls}`}>{action}</span>;
}
const shortId = (id: string | null) => (id ? id.slice(0, 8) + "…" : "—");
const PAGE_SIZE = 50;

export function Audit() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { api.auditActions().then(setActions).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      api.auditPaged({ q, action: action || undefined, page, pageSize: PAGE_SIZE })
        .then((r) => { setRows(r.data); setTotal(r.total); setError(null); })
        .catch((e) => { setError(e instanceof Error ? e.message : "Erreur"); setRows([]); });
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, action, page]);
  useEffect(() => { setPage(1); }, [q, action]);

  async function exportCsv() {
    setExporting(true);
    try { downloadBlob(`journal-audit-${new Date().toISOString().slice(0, 10)}.csv`, await api.auditCsv({ q, action: action || undefined })); }
    catch (e) { setError(e instanceof Error ? e.message : "Export échoué"); }
    finally { setExporting(false); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{rows == null ? "…" : `${total} événement${total > 1 ? "s" : ""}`}</div>
          <h1>Journal d'audit</h1>
          <div className="sub">Traçabilité des actions sensibles (comptes, contenus, certificats, connexions). Cliquez une ligne pour le détail.</div>
        </div>
        <span className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <ViewsBar screen="audit" config={{ q, action }} onApply={(c) => { setQ((c.q as string) ?? ""); setAction((c.action as string) ?? ""); }} />
          <select className="select" value={action} onChange={(e) => setAction(e.target.value)} title="Filtrer par action" style={{ maxWidth: 220 }}>
            <option value="">Toutes les actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <label className="search" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-pill)", padding: "8px 14px", width: 230 }}>
            <input style={{ border: 0, background: "none", outline: "none", fontFamily: "inherit", fontSize: 13, width: "100%" }} placeholder="Rechercher (cible, IP, acteur)…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button className="btn" disabled={exporting || total === 0} onClick={() => void exportCsv()} title="Exporter la recherche courante en CSV (jusqu'à 10 000 lignes)">{exporting ? "…" : "⤓ CSV"}</button>
        </span>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Quand</th><th>Action</th><th>Cible</th><th>Acteur</th><th>IP</th></tr></thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <Fragment key={r.id}>
                <tr onClick={() => setOpen(open === r.id ? null : r.id)} style={{ cursor: "pointer" }}>
                  <td><span style={{ fontSize: 12.5 }}>{ago(r.at)}</span><div className="muted" style={{ fontSize: 11 }}>{new Date(r.at).toLocaleTimeString("fr-FR")}</div></td>
                  <td>{actionPill(r.action)}</td>
                  <td><span style={{ fontSize: 12.5 }}>{r.targetType ?? "—"}</span> <code className="muted" style={{ fontSize: 11 }}>{shortId(r.targetId)}</code></td>
                  <td>{r.actor
                    ? <span style={{ fontSize: 12.5 }}><b>{r.actor.name}</b><div className="muted" style={{ fontSize: 11 }}>{r.actor.email}</div></span>
                    : <code className="muted" style={{ fontSize: 12 }}>{shortId(r.actorId)}</code>}</td>
                  <td><span className="muted" style={{ fontSize: 12 }}>{r.ip ?? "—"}</span></td>
                </tr>
                {open === r.id && (
                  <tr><td colSpan={5} style={{ background: "var(--bg-soft)" }}>
                    <div style={{ fontSize: 12, display: "grid", gap: 4 }}>
                      <div><b>Horodatage :</b> {new Date(r.at).toLocaleString("fr-FR")}</div>
                      {r.targetId && <div><b>Cible :</b> {r.targetType ?? "?"} <code>{r.targetId}</code></div>}
                      {r.actorId && <div><b>Acteur :</b> {r.actor ? `${r.actor.name} <${r.actor.email}>` : "compte supprimé"} <code>{r.actorId}</code></div>}
                      {r.meta && <div><b>Détail :</b> <pre style={{ margin: "4px 0 0", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(r.meta, null, 2)}</pre></div>}
                    </div>
                  </td></tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {rows == null && <div className="empty">Chargement du journal…</div>}
          {error && <div className="empty" style={{ color: "var(--danger)" }}>Erreur : {error}</div>}
          {rows != null && !error && rows.length === 0 && <div className="empty"><div className="big">🗒️</div>Aucun événement d'audit.</div>}
          {rows != null && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
        </div>
      </div>
    </div>
  );
}
