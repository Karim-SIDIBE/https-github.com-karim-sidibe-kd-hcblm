import { useState } from "react";
import { api, type Session, type SessionRegistrant, type UserRow } from "../lib/api";
import { useAsync } from "../lib/ui";
import type { CourseCtx } from "../App";

const STATUS: Record<string, { cls: string; label: string }> = {
  SCHEDULED: { cls: "pill--info", label: "Planifiée" },
  LIVE: { cls: "pill--green", label: "En direct" },
  ENDED: { cls: "pill--soft", label: "Terminée" },
  CANCELLED: { cls: "pill--red", label: "Annulée" },
};
const PROVIDER: Record<string, string> = { ZOOM: "Zoom", TEAMS: "Microsoft Teams", MANUAL: "Lien manuel" };
const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const sel = { padding: "7px 10px", border: "1px solid var(--line-strong)", borderRadius: 8, background: "var(--bg)", fontFamily: "inherit", fontSize: 13 } as const;

/** Blended learning — planifier, inscrire, émarger (alimente le xAPI `attended`). */
export function Sessions({ ctx }: { ctx: CourseCtx }) {
  const { data, loading, reload } = useAsync<Session[]>(() => api.sessions(), []);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = data ?? [];
  const open = rows.find((s) => s.id === openId) ?? null;

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Blended learning · {rows.length} session{rows.length > 1 ? "s" : ""}</div>
          <h1>Sessions live</h1>
          <div className="sub">Webinaires et ateliers (Zoom / Teams) liés aux parcours — l'émargement alimente les traces xAPI.</div>
        </div>
        <button className="btn btn--primary" onClick={() => setCreating((v) => !v)}>{creating ? "Fermer" : "+ Planifier une session"}</button>
      </div>

      {creating && <CreateForm ctx={ctx} onDone={() => { setCreating(false); reload(); }} />}

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Session</th><th>Date & heure</th><th>Durée</th><th>Fournisseur</th><th>Inscrits</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const st = STATUS[s.status] ?? { cls: "pill--soft", label: s.status };
                return (
                  <tr key={s.id} style={{ cursor: "default" }}>
                    <td><b style={{ fontSize: 13.5 }}>{s.title}</b></td>
                    <td><span style={{ fontSize: 12.5 }}>{fmt(s.startsAt)}</span></td>
                    <td><span className="muted" style={{ fontSize: 12.5 }}>{s.durationMin} min</span></td>
                    <td><span className="pill pill--soft">{PROVIDER[s.provider] ?? s.provider}</span></td>
                    <td><span className="num">{s._count?.registrations ?? 0}</span></td>
                    <td><span className={`pill ${st.cls}`}><span className="dot" />{st.label}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn--sm btn--ghost" onClick={() => setOpenId(openId === s.id ? null : s.id)}>{openId === s.id ? "Fermer" : "Gérer"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && <div className="empty">Chargement des sessions…</div>}
          {!loading && rows.length === 0 && <div className="empty"><div className="big">🎥</div>Aucune session planifiée. Créez un webinaire Zoom/Teams lié à un parcours.</div>}
        </div>
      </div>

      {open && <Detail session={open} onChanged={reload} />}
    </div>
  );
}

function CreateForm({ ctx, onDone }: { ctx: CourseCtx; onDone: () => void }) {
  const [f, setF] = useState({ title: "", provider: "ZOOM", date: "", time: "", durationMin: 60, joinUrl: "", courseId: ctx.courseId, capacity: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = f.title.trim() && f.date && f.time && f.durationMin > 0;

  async function submit() {
    setBusy(true); setError(null);
    try {
      await api.createSession({
        title: f.title.trim(), provider: f.provider,
        startsAt: new Date(`${f.date}T${f.time}`).toISOString(),
        durationMin: Number(f.durationMin),
        ...(f.joinUrl.trim() ? { joinUrl: f.joinUrl.trim() } : {}),
        ...(f.courseId ? { courseId: f.courseId } : {}),
        ...(f.capacity ? { capacity: Number(f.capacity) } : {}),
      });
      onDone();
    } catch (e: any) { setError(e?.message || "Erreur de création"); }
    finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h"><b>Nouvelle session</b></div>
      <div className="card-b" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...sel, width: 260 }} placeholder="Titre (ex. Atelier priorisation)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select style={sel} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>
          <option value="ZOOM">Zoom</option><option value="TEAMS">Microsoft Teams</option><option value="MANUAL">Lien manuel</option>
        </select>
        <input style={sel} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <input style={sel} type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        <label style={{ fontSize: 12.5 }}>Durée <input style={{ ...sel, width: 70 }} type="number" min={15} step={15} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} /> min</label>
        <input style={{ ...sel, width: 240 }} placeholder="Lien de réunion (optionnel)" value={f.joinUrl} onChange={(e) => setF({ ...f, joinUrl: e.target.value })} />
        <select style={sel} value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}>
          <option value="">(sans parcours)</option>
          {ctx.courses.map((c) => <option key={c.id} value={c.id}>{c.versions[0]?.title ?? c.slug}</option>)}
        </select>
        <input style={{ ...sel, width: 90 }} type="number" min={1} placeholder="Places" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
        <button className="btn btn--sm" disabled={busy || !ready} onClick={submit}>{busy ? "…" : "Planifier"}</button>
      </div>
      {error && <div className="card-b" style={{ color: "var(--danger)" }}>{error}</div>}
    </div>
  );
}

function Detail({ session, onChanged }: { session: Session; onChanged: () => void }) {
  const roster = useAsync<SessionRegistrant[]>(() => api.sessionRoster(session.id), [session.id]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<UserRow[]>([]);
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editable = session.status === "SCHEDULED" || session.status === "LIVE";

  async function search(text: string) {
    setQ(text);
    if (text.trim().length < 2) { setFound([]); return; }
    try { setFound((await api.users(text.trim())).slice(0, 6)); } catch { setFound([]); }
  }
  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setError(null);
    try { await fn(); roster.reload(); onChanged(); }
    catch (e: any) { setError(e?.message || "Erreur"); }
    finally { setBusy(null); }
  }
  function markAll() {
    const entries = (roster.data ?? []).map((r) => ({
      userId: r.user.id,
      minutes: minutes[r.user.id] ? Number(minutes[r.user.id]) : session.durationMin,
    }));
    if (entries.length) void act("attendance", () => api.markAttendance(session.id, entries));
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h">
        <b>{session.title} — inscrits & émargement</b>
        {editable && (
          <button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger-tint)" }} disabled={busy === "cancel"}
            onClick={() => { if (window.confirm("Annuler cette session ?")) void act("cancel", () => api.cancelSession(session.id)); }}>
            {busy === "cancel" ? "…" : "Annuler la session"}
          </button>
        )}
      </div>
      {error && <div className="card-b" style={{ color: "var(--danger)" }}>{error}</div>}

      {editable && (
        <div className="card-b" style={{ position: "relative" }}>
          <input style={{ ...sel, width: 320 }} placeholder="Inscrire un apprenant (nom ou e-mail)…" value={q} onChange={(e) => void search(e.target.value)} />
          {found.length > 0 && (
            <div style={{ position: "absolute", zIndex: 5, background: "var(--card, #fff)", border: "1px solid var(--line-strong)", borderRadius: 8, marginTop: 4, width: 320, boxShadow: "0 6px 18px rgba(0,0,0,.08)" }}>
              {found.map((u) => (
                <button key={u.id} className="btn btn--sm btn--ghost" style={{ display: "block", width: "100%", textAlign: "left" }} disabled={busy === u.id}
                  onClick={() => { setQ(""); setFound([]); void act(u.id, () => api.registerToSession(session.id, u.id)); }}>
                  {u.name} <span className="muted">({u.email})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Participant</th><th>Inscrit le</th><th>Présent</th><th>Minutes</th></tr></thead>
          <tbody>
            {(roster.data ?? []).map((r) => (
              <tr key={r.user.id}>
                <td><div className="who"><b style={{ fontSize: 13 }}>{r.user.name}</b><span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{r.user.email}</span></div></td>
                <td><span className="muted" style={{ fontSize: 12.5 }}>{fmt(r.registeredAt)}</span></td>
                <td>{r.attended ? <span className="pill pill--green"><span className="dot" />Présent{r.attendanceMinutes != null ? ` · ${r.attendanceMinutes} min` : ""}</span> : <span className="pill pill--soft">—</span>}</td>
                <td><input style={{ ...sel, width: 80 }} type="number" min={0} placeholder={String(session.durationMin)} value={minutes[r.user.id] ?? ""} onChange={(e) => setMinutes({ ...minutes, [r.user.id]: e.target.value })} /></td>
              </tr>
            ))}
            {!roster.loading && (roster.data?.length ?? 0) === 0 && <tr><td colSpan={4} className="muted">Aucun inscrit pour l'instant.</td></tr>}
          </tbody>
        </table>
      </div>
      {(roster.data?.length ?? 0) > 0 && (
        <div className="card-b">
          <button className="btn btn--sm" disabled={busy === "attendance"} onClick={markAll}>
            {busy === "attendance" ? "…" : "Émarger tous (minutes saisies, sinon durée totale)"}
          </button>
        </div>
      )}
    </div>
  );
}
