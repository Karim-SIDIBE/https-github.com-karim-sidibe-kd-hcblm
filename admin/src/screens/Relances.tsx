import { useMemo, useState } from "react";
import { api, courseTitle, type LearnerRow, type ReEngagementResult } from "../lib/api";
import { avatarColor, initials, ago, useAsync } from "../lib/ui";
import type { CourseCtx } from "../App";

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
              : <span>✅ Cycle de relances exécuté. <b>{result?.sent ?? result?.processed ?? 0}</b> relance(s) traitée(s). Les apprenants concernés recevront un message (email / SMS / push) selon le palier.</span>}
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
    </div>
  );
}
