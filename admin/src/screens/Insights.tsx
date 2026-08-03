import { useState } from "react";
import { api, type CourseInsights } from "../lib/api";
import { downloadBlob } from "../lib/csv";
import { useAsync } from "../lib/ui";
import type { CourseCtx } from "../App";

/**
 * Pilotage pédagogique — the local xAPI mini-LRS turned into steering signals:
 * hardest questions, real time-on-task, video completion, and the course
 * funnel. Plus the raw-data exports (CSV / NDJSON) and retention archives.
 */

const fmtDur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);

function Bar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div style={{ background: "var(--bg)", borderRadius: 6, height: 8, minWidth: 90, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: 6, background: color ?? "var(--brand)" }} />
    </div>
  );
}

export function Insights({ ctx }: { ctx: CourseCtx }) {
  const { data, loading, error } = useAsync<CourseInsights>(() => api.insights(ctx.courseId), [ctx.courseId]);
  const archives = useAsync<{ name: string; sizeBytes: number; createdAt: string }[]>(() => api.lrsArchives().catch(() => []), []);
  const [busy, setBusy] = useState<string | null>(null);

  async function doExport(format: "csv" | "ndjson") {
    setBusy(format);
    try { downloadBlob(`xapi-statements.${format}`, await api.exportStatements(ctx.courseId, format)); }
    catch (e: any) { alert(e?.message || "Erreur d'export"); }
    finally { setBusy(null); }
  }

  async function getArchive(name: string) {
    setBusy(name);
    try { downloadBlob(name, await api.downloadArchive(name)); }
    catch (e: any) { alert(e?.message || "Erreur de téléchargement"); }
    finally { setBusy(null); }
  }

  const course = ctx.courses.find((c) => c.id === ctx.courseId);
  const courseTitle = course?.versions.find((v) => v.status === "PUBLISHED")?.title ?? course?.versions[0]?.title ?? course?.slug;

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">xAPI · LRS local</div>
          <h1>Pilotage pédagogique</h1>
          <div className="sub">Ce que les traces d'apprentissage révèlent de « {courseTitle ?? "…"} » — {data ? `${data.enrolled} inscrit(s)` : "…"}.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--sm" disabled={busy === "csv"} onClick={() => doExport("csv")}>{busy === "csv" ? "…" : "Export CSV"}</button>
          <button className="btn btn--sm btn--ghost" disabled={busy === "ndjson"} onClick={() => doExport("ndjson")}>{busy === "ndjson" ? "…" : "Export NDJSON"}</button>
        </div>
      </div>

      {error && <div className="card"><div className="card-b" style={{ color: "var(--danger)" }}>{error}</div></div>}
      {loading && <div className="card"><div className="card-b">Calcul des indicateurs…</div></div>}

      {data && (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="card">
            <div className="card-h"><b>Questions les plus ratées</b><span className="muted" style={{ fontSize: 12 }}>taux de réussite croissant</span></div>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead><tr><th>Question</th><th>Rép.</th><th style={{ width: 150 }}>Réussite</th></tr></thead>
                <tbody>
                  {data.questions.slice(0, 12).map((q) => (
                    <tr key={q.questionId}>
                      <td title={q.label}><span style={{ fontSize: 12.5 }}>{q.label.length > 70 ? q.label.slice(0, 70) + "…" : q.label}</span><div className="muted" style={{ fontSize: 11 }}>Bloc {q.blockIndex ?? "—"} · {q.itemKey ?? ""}</div></td>
                      <td className="num">{q.total}</td>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Bar pct={q.pctCorrect} color={q.pctCorrect < 50 ? "var(--danger)" : q.pctCorrect < 75 ? "var(--warning, #d97706)" : "var(--success)"} /><span className="num" style={{ fontSize: 12 }}>{q.pctCorrect}%</span></div></td>
                    </tr>
                  ))}
                  {data.questions.length === 0 && <tr><td colSpan={3} className="muted">Pas encore de réponses de quiz enregistrées.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><b>Temps réel par élément</b><span className="muted" style={{ fontSize: 12 }}>moyenne par apprenant</span></div>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead><tr><th>Élément</th><th>Apprenants</th><th>Temps moyen</th></tr></thead>
                <tbody>
                  {data.time.map((t) => (
                    <tr key={`${t.blockIndex}:${t.itemKey}`}>
                      <td><span style={{ fontSize: 12.5 }}>Bloc {t.blockIndex} · {t.itemKey}</span></td>
                      <td className="num">{t.learners}</td>
                      <td className="num">{fmtDur(t.avgSeconds)}</td>
                    </tr>
                  ))}
                  {data.time.length === 0 && <tr><td colSpan={3} className="muted">Pas encore de temps mesurés.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><b>Complétion des vidéos</b><span className="muted" style={{ fontSize: 12 }}>≥ 90 % = visionnée</span></div>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead><tr><th>Vidéo</th><th>Apprenants</th><th style={{ width: 150 }}>Visionnage moyen</th><th>Terminée</th></tr></thead>
                <tbody>
                  {data.videos.map((v) => (
                    <tr key={`${v.blockIndex}:${v.itemKey}`}>
                      <td><span style={{ fontSize: 12.5 }}>Bloc {v.blockIndex ?? "—"} · {v.itemKey}</span></td>
                      <td className="num">{v.learners}</td>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Bar pct={v.avgPct} /><span className="num" style={{ fontSize: 12 }}>{v.avgPct}%</span></div></td>
                      <td className="num">{v.finishedPct}%</td>
                    </tr>
                  ))}
                  {data.videos.length === 0 && <tr><td colSpan={4} className="muted">Pas encore de lectures vidéo mesurées.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><b>Entonnoir du parcours</b><span className="muted" style={{ fontSize: 12 }}>% des inscrits ayant terminé chaque élément</span></div>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead><tr><th>Élément</th><th style={{ width: 170 }}>Complétion</th></tr></thead>
                <tbody>
                  {data.funnel.map((f) => (
                    <tr key={`${f.blockIndex}:${f.itemKey}`}>
                      <td title={f.label}><span style={{ fontSize: 12.5 }}>B{f.blockIndex} · {f.label.length > 55 ? f.label.slice(0, 55) + "…" : f.label}</span></td>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Bar pct={f.pctOfEnrolled} /><span className="num" style={{ fontSize: 12 }}>{f.pctOfEnrolled}%</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(archives.data?.length ?? 0) > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h"><b>Archives de rétention xAPI</b><span className="muted" style={{ fontSize: 12 }}>granulaire &gt; 12 mois, NDJSON compressé ré-importable</span></div>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Archive</th><th>Taille</th><th>Créée le</th><th></th></tr></thead>
              <tbody>
                {archives.data!.map((a) => (
                  <tr key={a.name}>
                    <td><span style={{ fontSize: 12.5 }}>{a.name}</span></td>
                    <td className="num">{(a.sizeBytes / 1024).toFixed(1)} Ko</td>
                    <td><span style={{ fontSize: 12.5 }}>{new Date(a.createdAt).toLocaleDateString("fr-FR")}</span></td>
                    <td style={{ textAlign: "right" }}><button className="btn btn--sm btn--ghost" disabled={busy === a.name} onClick={() => getArchive(a.name)}>{busy === a.name ? "…" : "Télécharger"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
