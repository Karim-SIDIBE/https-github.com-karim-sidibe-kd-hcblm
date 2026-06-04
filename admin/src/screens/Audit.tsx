import { useMemo, useState } from "react";
import { api, type AuditRow } from "../lib/api";
import { ago, useAsync } from "../lib/ui";

function actionPill(action: string) {
  const head = action.split(".")[0];
  const cls = head === "user" ? "pill--info" : head === "course" ? "pill--orange" : head === "auth" ? "pill--navy"
    : head === "credential" ? "pill--green" : head === "evaluation" ? "pill--warn" : "pill--soft";
  return <span className={`pill ${cls}`}>{action}</span>;
}
const shortId = (id: string | null) => (id ? id.slice(0, 8) + "…" : "—");

export function Audit() {
  const { data, loading, error } = useAsync<AuditRow[]>(() => api.audit(120), []);
  const [q, setQ] = useState("");
  const rows = useMemo(() => (data ?? []).filter((r) => q === "" || (r.action + (r.targetType ?? "") + (r.ip ?? "")).toLowerCase().includes(q.toLowerCase())), [data, q]);

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{loading ? "…" : `${rows.length} événement${rows.length > 1 ? "s" : ""}`}</div>
          <h1>Journal d'audit</h1>
          <div className="sub">Traçabilité des actions sensibles (comptes, contenus, certificats, connexions).</div>
        </div>
        <label className="search" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-pill)", padding: "8px 14px", width: 260 }}>
          <input style={{ border: 0, background: "none", outline: "none", fontFamily: "inherit", fontSize: 13, width: "100%" }} placeholder="Filtrer (action, cible, IP)…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Quand</th><th>Action</th><th>Cible</th><th>Acteur</th><th>IP</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ cursor: "default" }}>
                  <td><span style={{ fontSize: 12.5 }}>{ago(r.at)}</span><div className="muted" style={{ fontSize: 11 }}>{new Date(r.at).toLocaleTimeString("fr-FR")}</div></td>
                  <td>{actionPill(r.action)}</td>
                  <td><span style={{ fontSize: 12.5 }}>{r.targetType ?? "—"}</span> <code className="muted" style={{ fontSize: 11 }}>{shortId(r.targetId)}</code></td>
                  <td><code className="muted" style={{ fontSize: 12 }}>{shortId(r.actorId)}</code></td>
                  <td><span className="muted" style={{ fontSize: 12 }}>{r.ip ?? "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="empty">Chargement du journal…</div>}
          {error && <div className="empty" style={{ color: "var(--danger)" }}>Erreur : {error}</div>}
          {!loading && !error && rows.length === 0 && <div className="empty"><div className="big">🗒️</div>Aucun événement d'audit.</div>}
        </div>
      </div>
    </div>
  );
}
