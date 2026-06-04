import { useState } from "react";
import { IUsersK, IPulse, ITrophy, ITarget, IEval } from "../icons";
import { KPIS, FUNNEL, LEARNERS, RECENT, COHORTS, avatarColor, initials, type Risk } from "../mock";

const riskPill: Record<Risk, { cls: string; label: string }> = {
  ok: { cls: "pill--green", label: "À jour" },
  watch: { cls: "pill--warn", label: "À surveiller" },
  risk: { cls: "pill--red", label: "À risque" },
};

function Kpi({ icon, ic, val, lbl, trend }: { icon: JSX.Element; ic: string; val: string; lbl: string; trend?: number }) {
  return (
    <div className="kpi">
      {trend !== undefined && <span className={`trend ${trend >= 0 ? "trend--up" : "trend--down"}`}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%</span>}
      <div className={`ic ${ic}`}>{icon}</div>
      <div className="val num">{val}</div>
      <div className="lbl">{lbl}</div>
    </div>
  );
}

export function Dashboard() {
  const [cohort, setCohort] = useState(COHORTS[0]);
  const top = FUNNEL[0].reached;
  const atRisk = LEARNERS.filter((l) => l.risk !== "ok").slice(0, 5);

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Gestion du Temps · Niveau 1</div>
          <h1>Tableau de bord</h1>
          <div className="sub">Vue d'ensemble de la cohorte et de la progression certifiante.</div>
        </div>
        <div className="filters">
          <select className="select" value={cohort} onChange={(e) => setCohort(e.target.value)}>
            {COHORTS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="select" defaultValue="30 derniers jours"><option>7 derniers jours</option><option>30 derniers jours</option><option>Depuis le début</option></select>
          <button className="btn btn--primary">Exporter le rapport</button>
        </div>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi icon={<IUsersK />} ic="ic--orange" val={KPIS.enrolled.toLocaleString("fr-FR")} lbl="Apprenants inscrits" trend={KPIS.enrolledTrend} />
        <Kpi icon={<IPulse />} ic="ic--info" val={KPIS.active7d.toLocaleString("fr-FR")} lbl="Actifs (7 jours)" trend={KPIS.active7dTrend} />
        <Kpi icon={<ITrophy />} ic="ic--green" val={`${KPIS.completionRate}%`} lbl="Taux de complétion" trend={KPIS.completionTrend} />
        <Kpi icon={<ITarget />} ic="ic--navy" val={`${KPIS.forecast}%`} lbl="Prévision de certification" />
        <Kpi icon={<IEval />} ic="ic--warn" val={String(KPIS.projectsPending)} lbl="Projets Bloc 4 à évaluer" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.55fr 1fr" }}>
        <div className="card">
          <div className="card-h">
            <h3>Entonnoir de complétion par bloc</h3>
            <div className="legend"><span><i style={{ background: "var(--orange-500)" }} />Progression</span><span><i style={{ background: "var(--green)" }} />Certifiés</span></div>
          </div>
          <div className="card-b">
            <div className="funnel">
              {FUNNEL.map((b, i) => {
                const pct = Math.round((b.reached / top) * 100);
                return (
                  <div className={`row ${i === FUNNEL.length - 1 ? "is-cert" : ""}`} key={b.index}>
                    <div className="name">{b.label.split(" · ")[0]}<small>{b.label.split(" · ")[1]}</small></div>
                    <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                    <div className="figs"><b className="num">{b.reached}</b><span>{pct}% de la cohorte</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Apprenants à risque</h3><span className="pill pill--red"><span className="dot" />{LEARNERS.filter((l) => l.risk === "risk").length} critiques</span></div>
          <div className="card-b" style={{ paddingTop: 4 }}>
            <div className="risk">
              {atRisk.map((l) => (
                <div className="r" key={l.id}>
                  <span className="av" style={{ background: avatarColor(l.name) }}>{initials(l.name)}</span>
                  <div className="who"><b>{l.name}</b><span>Inactif · {l.lastActive.toLowerCase()} · Bloc {l.block}</span></div>
                  <span className={`pill ${riskPill[l.risk].cls}`}>{l.relance === "—" ? riskPill[l.risk].label : l.relance}</span>
                </div>
              ))}
            </div>
            <button className="btn btn--ghost btn--sm" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>Voir tous les apprenants à risque</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Activité récente</h3><a href="#/learners" className="btn btn--ghost btn--sm">Tout voir</a></div>
        <div className="card-b" style={{ paddingTop: 6 }}>
          <div className="risk">
            {RECENT.map((r, i) => (
              <div className="r" key={i}>
                <span className="av" style={{ background: avatarColor(r.who) }}>{initials(r.who)}</span>
                <div className="who"><b>{r.who}</b><span>{r.what}</span></div>
                <span className="muted" style={{ fontSize: 12 }}>{r.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
