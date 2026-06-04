import { api, type Session } from "../lib/api";
import { useAsync } from "../lib/ui";

const STATUS: Record<string, { cls: string; label: string }> = {
  SCHEDULED: { cls: "pill--info", label: "Planifiée" },
  LIVE: { cls: "pill--green", label: "En direct" },
  ENDED: { cls: "pill--soft", label: "Terminée" },
  CANCELLED: { cls: "pill--red", label: "Annulée" },
};
const PROVIDER: Record<string, string> = { ZOOM: "Zoom", TEAMS: "Microsoft Teams", MANUAL: "Lien manuel" };
const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export function Sessions() {
  const { data, loading } = useAsync<Session[]>(() => api.sessions(), []);
  const rows = data ?? [];

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Blended learning · {rows.length} session{rows.length > 1 ? "s" : ""}</div>
          <h1>Sessions live</h1>
          <div className="sub">Webinaires et ateliers (Zoom / Teams) liés aux parcours, avec présences.</div>
        </div>
        <button className="btn btn--primary">+ Planifier une session</button>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Session</th><th>Date & heure</th><th>Durée</th><th>Fournisseur</th><th>Inscrits</th><th>Statut</th></tr></thead>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && <div className="empty">Chargement des sessions…</div>}
          {!loading && rows.length === 0 && <div className="empty"><div className="big">🎥</div>Aucune session planifiée. Créez un webinaire Zoom/Teams lié à un parcours.</div>}
        </div>
      </div>
    </div>
  );
}
