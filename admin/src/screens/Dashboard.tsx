import { useState } from "react";
import { IUsersK, IPulse, ITrophy, ITarget, ICert } from "../icons";
import { api, courseTitle, type CourseReport, type AtRiskLearner, type CourseCompetencies, type KhcblmTargets } from "../lib/api";
import { avatarColor, initials, useAsync } from "../lib/ui";
import { table, downloadCsv, downloadBlob, today } from "../lib/csv";
import { ScheduledReports } from "./ScheduledReports";
import type { CourseCtx } from "../App";
import { modal } from "../lib/modal";

const BLOCK_FR: Record<string, string> = {
  ONBOARDING: "Onboarding · Ancrage", COMPREHENSION: "Compréhension", PRACTICE: "Pratique terrain", ANCHORING: "Ancrage", CERTIFICATION: "Certification",
};

// Drill-down navigation (UX-1): every headline number links to its detail
// screen; Learners picks up the preset filter/search via CustomEvents.
function goLearners(opts: { filter?: string; q?: string } = {}) {
  location.hash = "/learners";
  setTimeout(() => {
    if (opts.filter) window.dispatchEvent(new CustomEvent("kd-learners-filter", { detail: opts.filter }));
    window.dispatchEvent(new CustomEvent("kd-admin-search", { detail: opts.q ?? "" }));
  }, 60);
}

function Kpi({ icon, ic, val, lbl, onClick, hint }: { icon: JSX.Element; ic: string; val: string; lbl: string; onClick?: () => void; hint?: string }) {
  return (
    <div className="kpi" onClick={onClick} title={hint} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className={`ic ${ic}`}>{icon}</div>
      <div className="val num">{val}</div>
      <div className="lbl">{lbl}{onClick && <span style={{ opacity: 0.45 }}> ›</span>}</div>
    </div>
  );
}

const PERIODS = [
  { key: "", label: "Toute la durée", days: 0 },
  { key: "90", label: "Démarrés < 90 j", days: 90 },
  { key: "30", label: "Démarrés < 30 j", days: 30 },
  { key: "7", label: "Démarrés < 7 j", days: 7 },
] as const;

export function Dashboard({ ctx }: { ctx: CourseCtx }) {
  const { courseId, courses, setCourseId } = ctx;
  // Period filter (M4): restricts the KPIs to enrolments STARTED in the window
  // (badges/certificats counters stay all-time — they come from other tables).
  const [period, setPeriod] = useState("");
  const since = period ? new Date(Date.now() - Number(period) * 86_400_000).toISOString() : undefined;
  const rep = useAsync<CourseReport>(() => api.courseReport(courseId, since ? { since } : {}), [courseId, period]);
  const risk = useAsync<AtRiskLearner[]>(() => api.atRisk(courseId), [courseId]);
  const comp = useAsync<CourseCompetencies>(() => api.competencies(courseId), [courseId]);
  const targets = useAsync<KhcblmTargets>(() => api.khcblmTargets(courseId), [courseId]);

  const r = rep.data;
  const certified = r?.statusCounts?.CERTIFIED ?? r?.credentialsIssued ?? 0;
  const maxF = r ? Math.max(r.enrollments, ...r.blockFunnel.map((b) => b.completed), 1) : 1;
  const atRisk = (risk.data ?? []).slice(0, 6);
  const RISK_PILL: Record<string, string> = { high: "pill--red", medium: "pill--warn", low: "pill--soft" };
  const RISK_FR: Record<string, string> = { high: "Élevé", medium: "Moyen", low: "Faible" };

  // Full course report as a sectioned, Excel-ready CSV (KPIs + funnel + at-risk + competencies).
  function exportReport() {
    if (!r) return;
    const course = courses.find((c) => c.id === courseId);
    const titleLine = `RAPPORT;${course ? courseTitle(course) : "Parcours"};${today()}`;
    const kpi = "INDICATEURS\r\n" + table<{ k: string; v: string | number }>(
      [{ label: "Indicateur", value: (x) => x.k }, { label: "Valeur", value: (x) => x.v }],
      [
        { k: "Apprenants inscrits", v: r.enrollments },
        { k: "Actifs (7 jours)", v: r.activeLearners },
        { k: "Taux de complétion (%)", v: r.completionRate },
        { k: "Prévision de certification (%)", v: r.forecast.forecastPercent },
        { k: "Apprenants certifiés", v: certified },
        { k: "Certificats délivrés", v: r.credentialsIssued },
        { k: "Moyenne quiz final (%)", v: r.averageFinalQuiz ?? "" },
        { k: "Moyenne grille B4 (%)", v: r.averageRubric ?? "" },
      ],
    );
    const funnel = "ENTONNOIR PAR BLOC\r\n" + table(
      [
        { label: "Bloc", value: (b) => b.index },
        { label: "Type", value: (b) => BLOCK_FR[b.type] ?? b.type },
        { label: "Complétés", value: (b) => b.completed },
        { label: "% des inscrits", value: (b) => (r.enrollments ? Math.round((b.completed / r.enrollments) * 100) : 0) },
      ], r.blockFunnel,
    );
    const atRiskCsv = "APPRENANTS À RISQUE\r\n" + table<AtRiskLearner>(
      [
        { label: "Nom", value: (l) => l.name },
        { label: "E-mail", value: (l) => l.email },
        { label: "Progression (%)", value: (l) => l.progressPercent },
        { label: "Score de risque", value: (l) => l.riskScore },
        { label: "Niveau", value: (l) => RISK_FR[l.riskLevel] },
        { label: "Facteurs", value: (l) => l.factors.join(" · ") },
      ], risk.data ?? [],
    );
    const compCsv = "COMPÉTENCES DU GROUPE\r\n" + table(
      [
        { label: "Compétence", value: (c) => c.subArea },
        { label: "Score moyen (%)", value: (c) => c.avgPct },
        { label: "Apprenants évalués", value: (c) => c.learners },
      ], comp.data?.competencies ?? [],
    );
    downloadCsv(`rapport-${today()}.csv`, titleLine, kpi, funnel, atRiskCsv, compCsv);
  }

  // Server-side full report as a formatted, multi-sheet Excel workbook.
  async function exportExcel() {
    try { downloadBlob(`rapport-${today()}.xlsx`, await api.exportCourseXlsx(courseId)); }
    catch { await modal.alert({ title: "Export Excel indisponible pour le moment." }); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{courses.find((c) => c.id === courseId) ? courseTitle(courses.find((c) => c.id === courseId)!) : "Parcours"}</div>
          <h1>Tableau de bord</h1>
          <div className="sub">Vue d'ensemble de la progression certifiante.</div>
        </div>
        <div className="filters">
          <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)} title="Filtre de période : inscriptions démarrées dans la fenêtre">
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => <option key={c.id} value={c.id}>{courseTitle(c)}</option>)}
          </select>
          <button className="btn" onClick={exportReport} disabled={!r} title="Rapport complet en CSV (indicateurs, entonnoir, apprenants à risque, compétences)">⤓ CSV</button>
          <button className="btn btn--primary" onClick={exportExcel} title="Classeur Excel multi-onglets sur l'ensemble du parcours (côté serveur)">⤓ Excel</button>
        </div>
      </div>

      {rep.error && <div className="card"><div className="card-b" style={{ color: "var(--danger)" }}>Erreur : {rep.error}</div></div>}

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi icon={<IUsersK />} ic="ic--orange" val={r ? r.enrollments.toLocaleString("fr-FR") : "…"} lbl="Apprenants inscrits" hint="Voir la liste des apprenants" onClick={() => goLearners({ filter: "Tous" })} />
        <Kpi icon={<IPulse />} ic="ic--info" val={r ? r.activeLearners.toLocaleString("fr-FR") : "…"} lbl="Actifs (7 jours)" hint="Voir les apprenants en cours" onClick={() => goLearners({ filter: "En cours" })} />
        <Kpi icon={<ITrophy />} ic="ic--green" val={r ? `${r.completionRate}%` : "…"} lbl="Taux de complétion" hint="Analyser dans Pilotage pédagogique" onClick={() => { location.hash = "/insights"; }} />
        <Kpi icon={<ITarget />} ic="ic--navy" val={r ? `${r.forecast.forecastPercent}%` : "…"} lbl="Prévision de certification" hint="Analyser dans Pilotage pédagogique" onClick={() => { location.hash = "/insights"; }} />
        <Kpi icon={<ICert />} ic="ic--warn" val={r ? String(certified) : "…"} lbl="Apprenants certifiés" hint="Voir les apprenants certifiés" onClick={() => goLearners({ filter: "Certifiés" })} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.55fr 1fr" }}>
        <div className="card">
          <div className="card-h">
            <h3>Entonnoir de complétion par bloc</h3>
            <div className="legend"><span><i style={{ background: "var(--orange-500)" }} />Progression</span><span><i style={{ background: "var(--green)" }} />Certifiés</span></div>
          </div>
          <div className="card-b">
            {!r ? <div className="muted">Chargement…</div> : (
              <div className="funnel">
                {r.blockFunnel.map((b) => {
                  const pct = Math.round((b.completed / maxF) * 100);
                  const isCert = b.type === "CERTIFICATION";
                  return (
                    <div className={`row ${isCert ? "is-cert" : ""}`} key={b.index} style={{ cursor: "pointer" }} title="Analyser ce bloc dans Pilotage pédagogique" onClick={() => { location.hash = "/insights"; }}>
                      <div className="name">Bloc {b.index}<small>{BLOCK_FR[b.type] ?? b.type}</small></div>
                      <div className="bar"><i style={{ width: `${Math.max(pct, 2)}%` }} /></div>
                      <div className="figs"><b className="num">{b.completed}</b><span>{r.enrollments ? Math.round((b.completed / r.enrollments) * 100) : 0}% des inscrits</span></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Cibles K-HCBLM v2.2 <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(ch. 7 du modèle)</span></h3>
            {targets.data && (() => {
              const ms = targets.data.metrics.filter((m) => m.met != null);
              const okCount = ms.filter((m) => m.met).length;
              return <span className={`pill ${okCount === ms.length ? "pill--green" : "pill--warn"}`}>{okCount}/{ms.length} atteintes</span>;
            })()}
          </div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!targets.data ? <div className="muted">Chargement…</div> : targets.data.metrics.map((m) => (
              <div className="row between" key={m.key} style={{ gap: 8 }}>
                <span style={{ fontSize: 12.5 }}>{m.label}</span>
                <span className="row" style={{ gap: 6, flexShrink: 0 }}>
                  <b className="num" style={{ fontSize: 13 }}>{m.valuePct == null ? "—" : `${m.valuePct}%`}</b>
                  <span className={`pill pill--sm ${m.met == null ? "pill--soft" : m.met ? "pill--green" : "pill--red"}`}>cible ≥ {m.targetPct}%</span>
                </span>
              </div>
            ))}
            {targets.data && <div className="muted" style={{ fontSize: 11.5 }}>Mesures tous inscrits confondus ({targets.data.enrollments} inscription(s)) — les cibles s'apprécient sur une population représentative.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Apprenants à risque</h3><span className="pill pill--red"><span className="dot" />{atRisk.length}</span></div>
          <div className="card-b" style={{ paddingTop: 4 }}>
            {risk.loading ? <div className="muted">Chargement…</div>
              : atRisk.length === 0 ? <div className="empty" style={{ padding: "34px 10px" }}><div className="big">✅</div>Aucun apprenant à risque.</div>
              : <div className="risk">
                  {atRisk.map((l) => (
                    <div className="r" key={l.email} style={{ cursor: "pointer" }} title="Ouvrir la fiche dans Apprenants" onClick={() => goLearners({ q: l.email })}>
                      <span className="av" style={{ background: avatarColor(l.name) }}>{initials(l.name)}</span>
                      <div className="who"><b>{l.name}</b><span>{l.factors[0] ?? `${l.progressPercent}%`} · {l.progressPercent}%</span></div>
                      <span className={`pill ${RISK_PILL[l.riskLevel]}`} title={l.factors.join(" · ")}>{l.riskScore} · {RISK_FR[l.riskLevel]}</span>
                    </div>
                  ))}
                </div>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h" style={{ cursor: "pointer" }} title="Analyser dans Pilotage pédagogique" onClick={() => { location.hash = "/insights"; }}><h3>Forces &amp; faiblesses du groupe ›</h3>{comp.data && <span className="pill pill--soft">{comp.data.learnersAssessed} évalué{comp.data.learnersAssessed > 1 ? "s" : ""}</span>}</div>
        <div className="card-b" style={{ paddingTop: 6 }}>
          {comp.loading ? <div className="muted">Chargement…</div>
            : !comp.data?.competencies.length ? <div className="empty" style={{ padding: "26px 10px" }}><div className="big">📊</div>Aucun quiz diagnostique complété pour l'instant.</div>
            : <>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>Score moyen au diagnostique par compétence (les plus faibles en premier — à renforcer dans le contenu).</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {comp.data.competencies.map((c) => {
                    const col = c.avgPct < 50 ? "var(--danger)" : c.avgPct < 70 ? "var(--orange-500)" : "var(--green)";
                    return (
                      <div key={c.subArea}>
                        <div className="row between" style={{ fontSize: 13 }}><span>{c.subArea}</span><b className="num">{c.avgPct}%</b></div>
                        <div style={{ height: 8, background: "var(--bg-soft)", borderRadius: 999, marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(c.avgPct, 2)}%`, background: col, borderRadius: 999 }} /></div>
                      </div>
                    );
                  })}
                </div>
              </>}
        </div>
      </div>

      <ScheduledReports courseId={courseId} />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Badges & certificats délivrés</h3></div>
        <div className="card-b row" style={{ gap: 10, flexWrap: "wrap", paddingTop: 6 }}>
          {!r ? <span className="muted">Chargement…</span> : (<>
            {r.badgesIssued.length === 0 && <span className="muted">Aucun badge délivré pour l'instant.</span>}
            {r.badgesIssued.map((b) => <span key={b.type} className="pill pill--soft" style={{ fontSize: 13, padding: "6px 12px", cursor: "pointer" }} title="Voir les certificats" onClick={() => { location.hash = "/certs"; }}>{b.type} · <b className="num">{b.count}</b></span>)}
            <span className="pill pill--green" style={{ fontSize: 13, padding: "6px 12px", cursor: "pointer" }} title="Voir les certificats" onClick={() => { location.hash = "/certs"; }}>Certificats · <b className="num">{r.credentialsIssued}</b></span>
          </>)}
        </div>
      </div>
    </div>
  );
}
