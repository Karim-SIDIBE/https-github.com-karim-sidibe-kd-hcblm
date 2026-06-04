import { useMemo, useState } from "react";
import { LEARNERS, COHORTS, avatarColor, initials, type Risk, type B4 } from "../mock";

const riskPill: Record<Risk, { cls: string; label: string }> = {
  ok: { cls: "pill--green", label: "À jour" },
  watch: { cls: "pill--warn", label: "À surveiller" },
  risk: { cls: "pill--red", label: "À risque" },
};
const b4Pill: Record<B4, string> = {
  "—": "pill--soft", "soumis": "pill--info", "en évaluation": "pill--navy", "validé": "pill--green", "révision": "pill--orange",
};

export function Learners() {
  const [q, setQ] = useState("");
  const [cohort, setCohort] = useState(COHORTS[0]);
  const [risk, setRisk] = useState("Tous statuts");

  const rows = useMemo(() => LEARNERS.filter((l) =>
    (cohort === COHORTS[0] || l.cohort === cohort) &&
    (risk === "Tous statuts" || riskPill[l.risk].label === risk) &&
    (q === "" || (l.name + l.email).toLowerCase().includes(q.toLowerCase()))
  ), [q, cohort, risk]);

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{rows.length} apprenant{rows.length > 1 ? "s" : ""}</div>
          <h1>Apprenants</h1>
          <div className="sub">Gérez les comptes, les inscriptions et suivez chaque parcours.</div>
        </div>
        <div className="filters">
          <button className="btn">Importer une liste (CSV)</button>
          <button className="btn btn--primary">+ Inscrire un apprenant</button>
        </div>
      </div>

      <div className="card">
        <div className="card-h" style={{ paddingBottom: 14, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <label className="search" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", padding: "8px 14px", width: 300 }}>
            <input style={{ border: 0, background: "none", outline: "none", fontFamily: "inherit", fontSize: 13, width: "100%" }} placeholder="Rechercher par nom ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="row">
            <select className="select" value={cohort} onChange={(e) => setCohort(e.target.value)}>{COHORTS.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="select" value={risk} onChange={(e) => setRisk(e.target.value)}><option>Tous statuts</option><option>À jour</option><option>À surveiller</option><option>À risque</option></select>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr><th>Apprenant</th><th>Cohorte</th><th>Progression</th><th>Dernier badge</th><th>Projet B4</th><th>Dernière activité</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="uitem">
                      <span className="av" style={{ background: avatarColor(l.name) }}>{initials(l.name)}</span>
                      <div className="who"><b>{l.name}</b><span>{l.email}</span></div>
                    </div>
                  </td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>{l.cohort.split(" — ")[0]}</span></td>
                  <td>
                    <div className="progress"><div className="track"><i style={{ width: `${l.progress}%`, background: l.progress === 100 ? "var(--green)" : "var(--orange-500)" }} /></div><span className="pct">{l.progress}%</span></div>
                  </td>
                  <td>{l.lastBadge === "—" ? <span className="muted">—</span> : <span className="pill pill--soft">{l.lastBadge}</span>}</td>
                  <td><span className={`pill ${b4Pill[l.b4]}`}>{l.b4}</span></td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>{l.lastActive}</span></td>
                  <td><span className={`pill ${riskPill[l.risk].cls}`}><span className="dot" />{riskPill[l.risk].label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty"><div className="big">🔍</div>Aucun apprenant ne correspond à ces filtres.</div>}
        </div>
      </div>
    </div>
  );
}
