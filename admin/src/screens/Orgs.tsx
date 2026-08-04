import { useState } from "react";
import { api, type CohortDetail, type Cohort, type Org, type UserRow } from "../lib/api";
import { ago, useAsync } from "../lib/ui";
import type { CourseCtx } from "../App";

const sel = { padding: "7px 10px", border: "1px solid var(--line-strong)", borderRadius: 8, background: "var(--bg)", fontFamily: "inherit", fontSize: 13 } as const;

/** Cohortes gérables (création, membres) ; les organisations se gèrent dans « Entreprises & licences ». */
export function Orgs({ ctx }: { ctx: CourseCtx }) {
  const orgs = useAsync<Org[]>(() => api.organizations(), []);
  const cohorts = useAsync<Cohort[]>(() => api.cohorts(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true); setError(null);
    try {
      await api.createCohort(name.trim(), courseId || undefined);
      setName(""); setCreating(false); cohorts.reload();
    } catch (e: any) { setError(e?.message || "Erreur de création"); }
    finally { setBusy(false); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Organisation</div>
          <h1>Cohortes & clients</h1>
          <div className="sub">Promotions d'apprenants (avec forum de cohorte) et aperçu des organisations clientes.</div>
        </div>
        <button className="btn btn--primary" onClick={() => setCreating((v) => !v)}>{creating ? "Fermer" : "+ Nouvelle cohorte"}</button>
      </div>

      {creating && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-b" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input style={{ ...sel, width: 260 }} placeholder="Nom (ex. Promotion Septembre 2026)" value={name} onChange={(e) => setName(e.target.value)} />
            <select style={sel} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">(sans parcours)</option>
              {ctx.courses.map((c) => <option key={c.id} value={c.id}>{c.versions[0]?.title ?? c.slug}</option>)}
            </select>
            <button className="btn btn--sm" disabled={busy || name.trim().length === 0} onClick={create}>{busy ? "…" : "Créer la cohorte"}</button>
            {error && <span style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</span>}
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <div className="card">
          <div className="card-h"><h3>Cohortes</h3><span className="pill pill--soft">{cohorts.data?.length ?? 0}</span></div>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Cohorte</th><th>Membres</th><th>Fils</th><th>Créée</th><th></th></tr></thead>
              <tbody>
                {(cohorts.data ?? []).map((c) => (
                  <tr key={c.id} style={{ cursor: "default" }}>
                    <td><b style={{ fontSize: 13.5 }}>{c.name}</b></td>
                    <td><span className="num">{c._count?.memberships ?? 0}</span></td>
                    <td><span className="num">{c._count?.threads ?? 0}</span></td>
                    <td><span className="muted" style={{ fontSize: 12.5 }}>{ago(c.createdAt)}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn--sm btn--ghost" onClick={() => setOpenId(openId === c.id ? null : c.id)}>{openId === c.id ? "Fermer" : "Gérer"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cohorts.loading && <div className="empty">Chargement…</div>}
            {!cohorts.loading && (cohorts.data?.length ?? 0) === 0 && <div className="empty"><div className="big">👥</div>Aucune cohorte. Regroupez des apprenants en promotions.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Clients (organisations)</h3>
            <a className="btn btn--sm btn--ghost" href="#/entreprises">Gérer dans Entreprises →</a>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Client</th><th>Membres</th><th>Cours</th><th>Créé</th></tr></thead>
              <tbody>
                {(orgs.data ?? []).map((o) => (
                  <tr key={o.id} style={{ cursor: "default" }}>
                    <td><div className="who"><b style={{ fontSize: 13.5 }}>{o.name}</b><span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{o.slug}</span></div></td>
                    <td><span className="num">{o._count?.memberships ?? 0}</span></td>
                    <td><span className="num">{o._count?.courses ?? 0}</span></td>
                    <td><span className="muted" style={{ fontSize: 12.5 }}>{ago(o.createdAt)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orgs.loading && <div className="empty">Chargement…</div>}
            {!orgs.loading && (orgs.data?.length ?? 0) === 0 && <div className="empty"><div className="big">🏢</div>Aucun client. Créez une organisation depuis « Entreprises & licences ».</div>}
          </div>
        </div>
      </div>

      {openId && <CohortPanel id={openId} onChanged={cohorts.reload} />}
    </div>
  );
}

function CohortPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const detail = useAsync<CohortDetail>(() => api.cohortDetail(id), [id]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(text: string) {
    setQ(text);
    if (text.trim().length < 2) { setFound([]); return; }
    try {
      const members = new Set((detail.data?.members ?? []).map((m) => m.id));
      setFound((await api.users(text.trim())).filter((u) => !members.has(u.id)).slice(0, 6));
    } catch { setFound([]); }
  }
  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setError(null);
    try { await fn(); detail.reload(); onChanged(); }
    catch (e: any) { setError(e?.message || "Erreur"); }
    finally { setBusy(null); }
  }

  const d = detail.data;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h">
        <b>{d ? `${d.name} — ${d.members.length} membre(s)` : "Chargement…"}</b>
        {d?.courseSlug && <span className="pill pill--soft">{d.courseSlug}</span>}
      </div>
      {error && <div className="card-b" style={{ color: "var(--danger)" }}>{error}</div>}
      <div className="card-b" style={{ position: "relative" }}>
        <input style={{ ...sel, width: 320 }} placeholder="Ajouter un membre (nom ou e-mail)…" value={q} onChange={(e) => void search(e.target.value)} />
        {found.length > 0 && (
          <div style={{ position: "absolute", zIndex: 5, background: "var(--card, #fff)", border: "1px solid var(--line-strong)", borderRadius: 8, marginTop: 4, width: 320, boxShadow: "0 6px 18px rgba(0,0,0,.08)" }}>
            {found.map((u) => (
              <button key={u.id} className="btn btn--sm btn--ghost" style={{ display: "block", width: "100%", textAlign: "left" }} disabled={busy === u.id}
                onClick={() => { setQ(""); setFound([]); void act(u.id, () => api.addCohortMember(id, u.id)); }}>
                {u.name} <span className="muted">({u.email})</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Membre</th><th>Rôle</th><th>Depuis</th><th></th></tr></thead>
          <tbody>
            {(d?.members ?? []).map((m) => (
              <tr key={m.id}>
                <td><div className="who"><b style={{ fontSize: 13 }}>{m.name}</b><span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{m.email}</span></div></td>
                <td><span className="pill pill--soft">{m.role.replace(/_/g, " ").toLowerCase()}</span></td>
                <td><span className="muted" style={{ fontSize: 12.5 }}>{ago(m.since)}</span></td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn--sm btn--ghost" style={{ color: "var(--danger)" }} disabled={busy === `rm:${m.id}`}
                    onClick={() => void act(`rm:${m.id}`, () => api.removeCohortMember(id, m.id))}>
                    {busy === `rm:${m.id}` ? "…" : "Retirer"}
                  </button>
                </td>
              </tr>
            ))}
            {d && d.members.length === 0 && <tr><td colSpan={4} className="muted">Aucun membre — ajoutez des apprenants ci-dessus.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
