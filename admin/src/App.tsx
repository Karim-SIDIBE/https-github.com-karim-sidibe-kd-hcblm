import { useEffect, useState } from "react";
import {
  IDash, ILearners, IEnrol, IReeng, ICourse, IEval, ICert, IOrg, ISession, IAudit, ISettings, ISearch,
} from "./icons";
import { Dashboard } from "./screens/Dashboard";
import { Learners } from "./screens/Learners";
import { Soon } from "./screens/Soon";

type NavItem = { id: string; label: string; Icon: () => JSX.Element; soon?: boolean };
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Pilotage", items: [
    { id: "dashboard", label: "Tableau de bord", Icon: IDash },
    { id: "learners", label: "Apprenants", Icon: ILearners },
    { id: "enrol", label: "Inscriptions", Icon: IEnrol },
    { id: "reeng", label: "Relances", Icon: IReeng, soon: true },
  ]},
  { group: "Pédagogie", items: [
    { id: "courses", label: "Cours", Icon: ICourse, soon: true },
    { id: "eval", label: "Projets Bloc 4", Icon: IEval, soon: true },
    { id: "certs", label: "Certificats", Icon: ICert, soon: true },
  ]},
  { group: "Organisation", items: [
    { id: "orgs", label: "Cohortes & clients", Icon: IOrg, soon: true },
    { id: "sessions", label: "Sessions live", Icon: ISession, soon: true },
  ]},
  { group: "Système", items: [
    { id: "audit", label: "Journal d'audit", Icon: IAudit, soon: true },
    { id: "settings", label: "Réglages", Icon: ISettings, soon: true },
  ]},
];
const TITLES: Record<string, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])));

function useHash() {
  const [h, setH] = useState(() => location.hash.replace(/^#\/?/, "") || "dashboard");
  useEffect(() => {
    const on = () => setH(location.hash.replace(/^#\/?/, "") || "dashboard");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return h;
}

function Brand() {
  return (
    <div className="brand">
      <img src="/logo-icon.png" alt="DECLICK DIGITAL" onError={(e) => ((e.currentTarget.style.display = "none"))} />
      <span className="wm">DECLICK <b>DIGITAL</b><span className="sub">ADMINISTRATION</span></span>
    </div>
  );
}

export function App() {
  const route = useHash();
  const go = (id: string) => { location.hash = `/${id}`; };

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <nav>
          {NAV.map((g) => (
            <div className="navgroup" key={g.group}>
              <div className="label">{g.group}</div>
              {g.items.map(({ id, label, Icon, soon }) => (
                <button key={id} className={`navitem ${route === id ? "on" : ""}`} onClick={() => go(id)}>
                  <Icon /> {label}{soon && <span className="soon">Bientôt</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="userbox">
          <div className="av">KD</div>
          <div className="who"><b>Admin · KOMPETENCES DECLICK</b><span>Super Admin</span></div>
          <button className="logout" title="Déconnexion">⎋</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumbs">Administration <span style={{ margin: "0 6px", color: "var(--line-strong)" }}>/</span> <b>{TITLES[route] ?? "Tableau de bord"}</b></div>
          <div className="spacer" />
          <label className="search"><ISearch /><input placeholder="Rechercher un apprenant, une cohorte…" /></label>
        </header>
        {route === "dashboard" ? <Dashboard />
          : route === "learners" ? <Learners />
          : <Soon title={TITLES[route] ?? "Module"} />}
      </div>
    </div>
  );
}
