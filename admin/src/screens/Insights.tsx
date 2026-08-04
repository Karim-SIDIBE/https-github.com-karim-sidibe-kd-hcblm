import { useEffect, useState } from "react";
import { api, type Cohort, type CourseInsights, type ExploreBucket, type InsightsCompare } from "../lib/api";
import { downloadBlob } from "../lib/csv";
import { useAsync } from "../lib/ui";
import type { CourseCtx } from "../App";
import { modal } from "../lib/modal";

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
    catch (e: any) { await modal.alert({ title: "Export impossible", body: e?.message || "Erreur d'export" }); }
    finally { setBusy(null); }
  }

  async function getArchive(name: string) {
    setBusy(name);
    try { downloadBlob(name, await api.downloadArchive(name)); }
    catch (e: any) { await modal.alert({ title: "Téléchargement impossible", body: e?.message || "Erreur de téléchargement" }); }
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

      <Explorer courseId={ctx.courseId} />
      <Compare courseId={ctx.courseId} />

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

const GROUPS: { id: string; label: string }[] = [
  { id: "verb", label: "Verbe" }, { id: "item", label: "Élément" }, { id: "block", label: "Bloc" },
  { id: "learner", label: "Apprenant" }, { id: "day", label: "Jour" }, { id: "activity", label: "Activité (IRI)" },
];
const VERBS = ["", "initialized", "completed", "passed", "failed", "answered", "progressed", "experienced", "earned", "registered", "attended"];

/** Explorateur de traces — agrégation libre façon « Series API ». */
function Explorer({ courseId }: { courseId: string }) {
  const [groupBy, setGroupBy] = useState("verb");
  const [verb, setVerb] = useState("");
  const [block, setBlock] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [rows, setRows] = useState<ExploreBucket[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true); setError(null);
    try {
      const f: Record<string, string> = {};
      if (verb) f.verb = verb;
      if (block !== "") f.blockIndex = block;
      if (since) f.since = new Date(since).toISOString();
      if (until) f.until = new Date(`${until}T23:59:59`).toISOString();
      setRows(await api.explore(courseId, groupBy, f));
    } catch (e: any) { setError(e?.message || "Erreur"); }
    finally { setBusy(false); }
  }
  useEffect(() => { setRows(null); }, [courseId]);

  const sel = { padding: "7px 10px", border: "1px solid var(--line-strong)", borderRadius: 8, background: "var(--bg)", fontFamily: "inherit", fontSize: 13 } as const;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h"><b>Explorateur de traces</b><span className="muted" style={{ fontSize: 12 }}>agrégation libre sur les statements xAPI</span></div>
      <div className="card-b" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12.5 }}>Regrouper par <select style={sel} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>{GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
        <label style={{ fontSize: 12.5 }}>Verbe <select style={sel} value={verb} onChange={(e) => setVerb(e.target.value)}>{VERBS.map((v) => <option key={v} value={v}>{v || "(tous)"}</option>)}</select></label>
        <label style={{ fontSize: 12.5 }}>Bloc <select style={sel} value={block} onChange={(e) => setBlock(e.target.value)}><option value="">(tous)</option>{[0, 1, 2, 3, 4].map((b) => <option key={b} value={String(b)}>Bloc {b}</option>)}</select></label>
        <label style={{ fontSize: 12.5 }}>Du <input style={sel} type="date" value={since} onChange={(e) => setSince(e.target.value)} /></label>
        <label style={{ fontSize: 12.5 }}>Au <input style={sel} type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
        <button className="btn btn--sm" disabled={busy} onClick={run}>{busy ? "…" : "Explorer"}</button>
      </div>
      {error && <div className="card-b" style={{ color: "var(--danger)" }}>{error}</div>}
      {rows && (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>{GROUPS.find((g) => g.id === groupBy)?.label}</th><th>Statements</th><th>Apprenants</th><th>Réussite</th><th>Temps cumulé</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td title={r.key}><span style={{ fontSize: 12.5 }}>{r.label.length > 70 ? r.label.slice(0, 70) + "…" : r.label}</span></td>
                  <td className="num">{r.statements}</td>
                  <td className="num">{r.learners}</td>
                  <td className="num">{r.successPct != null ? `${r.successPct}%` : "—"}</td>
                  <td className="num">{r.minutes != null ? `${r.minutes} min` : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="muted">Aucune trace pour ces filtres.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Comparaison de segments — deux périodes d'inscription ou deux cohortes. */
function Compare({ courseId }: { courseId: string }) {
  const [mode, setMode] = useState<"period" | "cohort">("period");
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [pA, setPA] = useState({ from: "", to: "" });
  const [pB, setPB] = useState({ from: "", to: "" });
  const [cA, setCA] = useState(""); const [cB, setCB] = useState("");
  const [result, setResult] = useState<InsightsCompare | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.cohorts().then(setCohorts).catch(() => {}); }, []);
  useEffect(() => { setResult(null); }, [courseId]);

  const ready = mode === "period" ? pA.from && pA.to && pB.from && pB.to : cA && cB;
  async function run() {
    setBusy(true); setError(null);
    try {
      const params: Record<string, string> = mode === "period"
        ? { mode, sinceA: new Date(pA.from).toISOString(), untilA: new Date(`${pA.to}T23:59:59`).toISOString(), sinceB: new Date(pB.from).toISOString(), untilB: new Date(`${pB.to}T23:59:59`).toISOString() }
        : { mode, cohortA: cA, cohortB: cB };
      setResult(await api.compareInsights(courseId, params));
    } catch (e: any) { setError(e?.message || "Erreur"); }
    finally { setBusy(false); }
  }

  const sel = { padding: "7px 10px", border: "1px solid var(--line-strong)", borderRadius: 8, background: "var(--bg)", fontFamily: "inherit", fontSize: 13 } as const;
  const Delta = ({ a, b, unit = "%" }: { a: number | null; b: number | null; unit?: string }) => {
    if (a == null || b == null) return <span className="muted">—</span>;
    const d = b - a;
    const color = d > 0 ? "var(--success)" : d < 0 ? "var(--danger)" : "var(--muted, #64748b)";
    return <b style={{ color }}>{d > 0 ? "+" : ""}{d}{unit}</b>;
  };
  const METRICS: { label: string; get: (s: InsightsCompare["a"]["summary"]) => number | null; unit?: string }[] = [
    { label: "Inscrits", get: (s) => s.enrolled, unit: "" },
    { label: "Réussite moyenne aux questions", get: (s) => s.avgQuestionPct },
    { label: "Complétion fin de parcours", get: (s) => s.funnelEndPct },
    { label: "Vidéos terminées (moyenne)", get: (s) => s.avgVideoFinishedPct },
  ];
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h"><b>Comparaison de segments</b><span className="muted" style={{ fontSize: 12 }}>avant/après une refonte, cohorte A vs B</span></div>
      <div className="card-b" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12.5 }}>Mode <select style={sel} value={mode} onChange={(e) => { setMode(e.target.value as "period" | "cohort"); setResult(null); }}>
          <option value="period">Périodes d'inscription</option><option value="cohort">Cohortes</option>
        </select></label>
        {mode === "period" ? (
          <>
            <span style={{ fontSize: 12.5 }}><b>A</b> du <input style={sel} type="date" value={pA.from} onChange={(e) => setPA({ ...pA, from: e.target.value })} /> au <input style={sel} type="date" value={pA.to} onChange={(e) => setPA({ ...pA, to: e.target.value })} /></span>
            <span style={{ fontSize: 12.5 }}><b>B</b> du <input style={sel} type="date" value={pB.from} onChange={(e) => setPB({ ...pB, from: e.target.value })} /> au <input style={sel} type="date" value={pB.to} onChange={(e) => setPB({ ...pB, to: e.target.value })} /></span>
          </>
        ) : (
          <>
            <label style={{ fontSize: 12.5 }}><b>A</b> <select style={sel} value={cA} onChange={(e) => setCA(e.target.value)}><option value="">(choisir)</option>{cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label style={{ fontSize: 12.5 }}><b>B</b> <select style={sel} value={cB} onChange={(e) => setCB(e.target.value)}><option value="">(choisir)</option>{cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          </>
        )}
        <button className="btn btn--sm" disabled={busy || !ready} onClick={run}>{busy ? "…" : "Comparer"}</button>
      </div>
      {error && <div className="card-b" style={{ color: "var(--danger)" }}>{error}</div>}
      {result && (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Indicateur</th><th>Segment A</th><th>Segment B</th><th>Écart (B − A)</th></tr></thead>
            <tbody>
              {METRICS.map((m) => {
                const a = m.get(result.a.summary); const b = m.get(result.b.summary);
                return (
                  <tr key={m.label}>
                    <td><span style={{ fontSize: 12.5 }}>{m.label}</span></td>
                    <td className="num">{a != null ? `${a}${m.unit ?? "%"}` : "—"}</td>
                    <td className="num">{b != null ? `${b}${m.unit ?? "%"}` : "—"}</td>
                    <td><Delta a={a} b={b} unit={m.unit ?? "%"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="card-b muted" style={{ fontSize: 12 }}>
            Les indicateurs détaillés de chaque segment (questions, entonnoir complet, vidéos) suivent la même définition que les tableaux ci-dessus.
          </div>
        </div>
      )}
    </div>
  );
}
