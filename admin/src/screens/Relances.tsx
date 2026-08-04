import { useEffect, useMemo, useState } from "react";
import { api, courseTitle, type LearnerRow, type ReEngagementResult, type RelanceRow } from "../lib/api";
import { avatarColor, initials, ago, useAsync } from "../lib/ui";
import { Pager } from "../lib/widgets";
import type { CourseCtx } from "../App";

const STAGE_FR: Record<string, { label: string; cls: string }> = {
  J3: { label: "J+3", cls: "pill--warn" },
  J7: { label: "J+7", cls: "pill--orange" },
  J14: { label: "J+14", cls: "pill--red" },
};

const daysSince = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : 999;

const TIERS = [
  { id: "j3", label: "J+3 · relance positionnelle", hint: "Inactif 3 à 6 jours", min: 3, max: 6, cls: "pill--warn" },
  { id: "j7", label: "J+7 · reconnexion Ancrage", hint: "Inactif 7 à 13 jours", min: 7, max: 13, cls: "pill--orange" },
  { id: "j14", label: "J+14 · escalade", hint: "Inactif 14 jours et +", min: 14, max: 9999, cls: "pill--red" },
] as const;

export function Relances({ ctx }: { ctx: CourseCtx }) {
  const { courseId, courses, setCourseId } = ctx;
  const { data, loading } = useAsync<LearnerRow[]>(() => api.courseLearners(courseId), [courseId]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReEngagementResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const buckets = useMemo(() => {
    // Bucket by days since last activity (≥3 j), regardless of the binary
    // 7-day "active" flag — a learner inactive 4 days belongs to the J+3 tier.
    const dormant = (data ?? []).filter((l) => l.status !== "CERTIFIED" && daysSince(l.lastActivity) >= 3).map((l) => ({ l, d: daysSince(l.lastActivity) }));
    return TIERS.map((t) => ({ ...t, rows: dormant.filter((x) => x.d >= t.min && x.d <= t.max).sort((a, b) => b.d - a.d) }));
  }, [data]);

  // History of every re-engagement message sent for this course (audit trail).
  const [hist, setHist] = useState<RelanceRow[] | null>(null);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage, setHistPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (!courseId) return;
    api.relancesHistory(courseId, { page: histPage, pageSize: 15 })
      .then((r) => { setHist(r.data); setHistTotal(r.total); })
      .catch(() => { setHist([]); setHistTotal(0); });
  }, [courseId, histPage, result]);
  useEffect(() => { setHistPage(1); }, [courseId]);

  async function runCycle() {
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await api.runReEngagement()); } catch (e: any) { setErr(e?.message || "Erreur"); } finally { setBusy(false); }
  }

  const totalToRelance = buckets.reduce((s, b) => s + b.rows.length, 0);

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Engagement · {totalToRelance} à relancer</div>
          <h1>Relances</h1>
          <div className="sub">Apprenants inactifs, classés par palier de relance automatique (J+3 / J+7 / J+14).</div>
        </div>
        <div className="filters">
          <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>{courses.map((c) => <option key={c.id} value={c.id}>{courseTitle(c)}</option>)}</select>
          <button className="btn btn--primary" disabled={busy} onClick={runCycle}>{busy ? "Envoi…" : "Lancer le cycle de relances"}</button>
        </div>
      </div>

      {(result || err) && (
        <div className="card" style={{ marginBottom: 16, background: err ? "var(--danger-tint)" : "var(--success-tint)", border: "none" }}>
          <div className="card-b" style={{ fontSize: 13.5 }}>
            {err ? <span style={{ color: "var(--danger)" }}>✗ {err}</span>
              : <span>✅ Cycle exécuté : <b>{result?.created.length ?? 0}</b> relance(s) envoyée(s) sur {result?.scanned ?? 0} inscription(s) analysée(s). Les paliers déjà relancés ne sont jamais redéclenchés (idempotent).</span>}
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {buckets.map((t) => (
          <div className="card" key={t.id}>
            <div className="card-h" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <div className="row between" style={{ width: "100%" }}><h3 style={{ fontSize: 14 }}>{t.label}</h3><span className={`pill ${t.cls}`}>{t.rows.length}</span></div>
              <span className="muted" style={{ fontSize: 11.5 }}>{t.hint}</span>
            </div>
            <div className="card-b" style={{ paddingTop: 8 }}>
              {loading ? <div className="muted">Chargement…</div>
                : t.rows.length === 0 ? <div className="empty" style={{ padding: "28px 8px", fontSize: 12.5 }}>Personne dans ce palier 👍</div>
                : <div className="risk">
                    {t.rows.slice(0, 8).map(({ l, d }) => (
                      <div className="r" key={l.email} style={{ padding: "9px 2px" }}>
                        <span className="av" style={{ background: avatarColor(l.name), width: 30, height: 30, fontSize: 11 }}>{initials(l.name)}</span>
                        <div className="who"><b style={{ fontSize: 12.5 }}>{l.name}</b><span>Inactif {d} j · {l.progressPercent}% · {ago(l.lastActivity).toLowerCase()}</span></div>
                      </div>
                    ))}
                    {t.rows.length > 8 && <div className="muted" style={{ fontSize: 12, textAlign: "center", paddingTop: 8 }}>+ {t.rows.length - 8} autre(s)</div>}
                  </div>}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h" style={{ paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
          <b style={{ fontSize: 13.5 }}>Historique des relances envoyées</b>
          <span className="muted" style={{ fontSize: 12 }}>{histTotal} message(s) · cliquez une ligne pour lire le message</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Quand</th><th>Apprenant</th><th>Palier</th><th>Canal</th><th>Message</th></tr></thead>
            <tbody>
              {(hist ?? []).map((r) => (
                <tr key={r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)} style={{ cursor: "pointer" }}>
                  <td><span style={{ fontSize: 12.5 }}>{ago(r.sentAt)}</span><div className="muted" style={{ fontSize: 11 }}>{new Date(r.sentAt).toLocaleString("fr-FR")}</div></td>
                  <td><div className="uitem"><span className="av" style={{ background: avatarColor(r.learner.name), width: 28, height: 28, fontSize: 10.5 }}>{initials(r.learner.name)}</span><div className="who"><b style={{ fontSize: 12.5 }}>{r.learner.name}</b><span>{r.learner.email}</span></div></div></td>
                  <td><span className={`pill ${STAGE_FR[r.stage]?.cls ?? "pill--soft"}`}>{STAGE_FR[r.stage]?.label ?? r.stage}</span></td>
                  <td><span className="muted" style={{ fontSize: 12 }}>{r.channel === "ADMIN" ? "alerte admin" : "apprenant"}</span></td>
                  <td style={{ maxWidth: 420 }}>
                    {openId === r.id
                      ? <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{r.body}</div>
                      : <span className="muted" style={{ fontSize: 12, display: "inline-block", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.body}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hist == null && <div className="empty">Chargement de l'historique…</div>}
          {hist != null && hist.length === 0 && <div className="empty"><div className="big">📣</div>Aucune relance envoyée pour ce parcours pour l'instant.</div>}
          {hist != null && <Pager page={histPage} pageSize={15} total={histTotal} onPage={setHistPage} />}
        </div>
      </div>
    </div>
  );
}
