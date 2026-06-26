import { IUsersK, IPulse, ITrophy, ITarget, ICert } from "../icons";
import { api, courseTitle, type CourseReport, type AtRiskLearner, type CourseCompetencies } from "../lib/api";
import { avatarColor, initials, useAsync } from "../lib/ui";
import { table, downloadCsv, downloadBlob, today } from "../lib/csv";
import type { CourseCtx } from "../App";

const BLOCK_FR: Record<string, string> = {
  ONBOARDING: "Onboarding · Ancrage", COMPREHENSION: "Compréhension", PRACTICE: "Pratique terrain", ANCHORING: "Ancrage", CERTIFICATION: "Certification",
};

function Kpi({ icon, ic, val, lbl }: { icon: JSX.Element; ic: string; val: string; lbl: string }) {
  return (
    <div className="kpi">
      <div className={`ic ${ic}`}>{icon}</div>
      <div className="val num">{val}</div>
      <div className="lbl">{lbl}</div>
    </div>
  );
}

export function Dashboard({ ctx }: { ctx: CourseCtx }) {
  const { courseId, courses, setCourseId } = ctx;
  const rep = useAsync<CourseReport>(() => api.courseReport(courseId), [courseId]);
  const risk = useAsync<AtRiskLearner[]>(() => api.atRisk(courseId), [courseId]);
  const comp = useAsync<CourseCompetencies>(() => api.competencies(courseId), [courseId]);

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
    catch { window.alert("Export Excel indisponible pour le moment."); }
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
          <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => <option key={c.id} value={c.id}>{courseTitle(c)}</option>)}
          </select>
          <button className="btn" onClick={exportReport} disabled={!r} title="Rapport complet en CSV (indicateurs, entonnoir, apprenants à risque, compétences)">⤓ CSV</button>
          <button className="btn btn--primary" onClick={exportExcel} title="Classeur Excel multi-onglets sur l'ensemble du parcours (côté serveur)">⤓ Excel</button>
        </div>
      </div>

      {rep.error && <div className="card"><div className="card-b" style={{ color: "var(--danger)" }}>Erreur : {rep.error}</div></div>}

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi icon={<IUsersK />} ic="ic--orange" val={r ? r.enrollments.toLocaleString("fr-FR") : "…"} lbl="Apprenants inscrits" />
        <Kpi icon={<IPulse />} ic="ic--info" val={r ? r.activeLearners.toLocaleString("fr-FR") : "…"} lbl="Actifs (7 jours)" />
        <Kpi icon={<ITrophy />} ic="ic--green" val={r ? `${r.completionRate}%` : "…"} lbl="Taux de complétion" />
        <Kpi icon={<ITarget />} ic="ic--navy" val={r ? `${r.forecast.forecastPercent}%` : "…"} lbl="Prévision de certification" />
        <Kpi icon={<ICert />} ic="ic--warn" val={r ? String(certified) : "…"} lbl="Apprenants certifiés" />
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
                    <div className={`row ${isCert ? "is-cert" : ""}`} key={b.index}>
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
          <div className="card-h"><h3>Apprenants à risque</h3><span className="pill pill--red"><span className="dot" />{atRisk.length}</span></div>
          <div className="card-b" style={{ paddingTop: 4 }}>
            {risk.loading ? <div className="muted">Chargement…</div>
              : atRisk.length === 0 ? <div className="empty" style={{ padding: "34px 10px" }}><div className="big">✅</div>Aucun apprenant à risque.</div>
              : <div className="risk">
                  {atRisk.map((l) => (
                    <div className="r" key={l.email}>
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
        <div className="card-h"><h3>Forces &amp; faiblesses du groupe</h3>{comp.data && <span className="pill pill--soft">{comp.data.learnersAssessed} évalué{comp.data.learnersAssessed > 1 ? "s" : ""}</span>}</div>
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

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Badges & certificats délivrés</h3></div>
        <div className="card-b row" style={{ gap: 10, flexWrap: "wrap", paddingTop: 6 }}>
          {!r ? <span className="muted">Chargement…</span> : (<>
            {r.badgesIssued.length === 0 && <span className="muted">Aucun badge délivré pour l'instant.</span>}
            {r.badgesIssued.map((b) => <span key={b.type} className="pill pill--soft" style={{ fontSize: 13, padding: "6px 12px" }}>{b.type} · <b className="num">{b.count}</b></span>)}
            <span className="pill pill--green" style={{ fontSize: 13, padding: "6px 12px" }}>Certificats · <b className="num">{r.credentialsIssued}</b></span>
          </>)}
        </div>
      </div>
    </div>
  );
}
