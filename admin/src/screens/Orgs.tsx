import { api, type Org, type Cohort } from "../lib/api";
import { ago, useAsync } from "../lib/ui";

export function Orgs() {
  const orgs = useAsync<Org[]>(() => api.organizations(), []);
  const cohorts = useAsync<Cohort[]>(() => api.cohorts(), []);

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Organisation</div>
          <h1>Cohortes & clients</h1>
          <div className="sub">Entreprises clientes (Orange CI, MTN…) et promotions d'apprenants.</div>
        </div>
        <button className="btn btn--primary">+ Nouveau client</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <div className="card">
          <div className="card-h"><h3>Clients (organisations)</h3><span className="pill pill--soft">{orgs.data?.length ?? 0}</span></div>
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
            {!orgs.loading && (orgs.data?.length ?? 0) === 0 && <div className="empty"><div className="big">🏢</div>Aucun client. Créez une organisation pour héberger ses cohortes.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Cohortes</h3><span className="pill pill--soft">{cohorts.data?.length ?? 0}</span></div>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Cohorte</th><th>Membres</th><th>Fils</th><th>Créée</th></tr></thead>
              <tbody>
                {(cohorts.data ?? []).map((c) => (
                  <tr key={c.id} style={{ cursor: "default" }}>
                    <td><b style={{ fontSize: 13.5 }}>{c.name}</b></td>
                    <td><span className="num">{c._count?.memberships ?? 0}</span></td>
                    <td><span className="num">{c._count?.threads ?? 0}</span></td>
                    <td><span className="muted" style={{ fontSize: 12.5 }}>{ago(c.createdAt)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cohorts.loading && <div className="empty">Chargement…</div>}
            {!cohorts.loading && (cohorts.data?.length ?? 0) === 0 && <div className="empty"><div className="big">👥</div>Aucune cohorte. Regroupez des apprenants en promotions.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
