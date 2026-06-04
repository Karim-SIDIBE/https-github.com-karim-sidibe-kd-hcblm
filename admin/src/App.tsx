import { useEffect, useMemo, useState } from "react";
import {
  IDash, ILearners, IEnrol, IReeng, ICourse, IEval, ICert, IOrg, ISession, IAudit, ISettings, ISearch,
} from "./icons";
import { auth, api, type CourseSummary, type Principal } from "./lib/api";
import { initials } from "./lib/ui";
import { Login } from "./screens/Login";
import { Dashboard } from "./screens/Dashboard";
import { Learners } from "./screens/Learners";
import { Enrol } from "./screens/Enrol";
import { Relances } from "./screens/Relances";
import { Audit } from "./screens/Audit";
import { Orgs } from "./screens/Orgs";
import { Entreprises } from "./screens/Entreprises";
import { Sessions } from "./screens/Sessions";
import { Evaluation } from "./screens/Evaluation";
import { Certificats } from "./screens/Certificats";
import { Cours } from "./screens/Cours";
import { Settings } from "./screens/Settings";
import { Soon } from "./screens/Soon";

type NavItem = { id: string; label: string; Icon: () => JSX.Element; soon?: boolean };
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Pilotage", items: [
    { id: "dashboard", label: "Tableau de bord", Icon: IDash },
    { id: "learners", label: "Apprenants", Icon: ILearners },
    { id: "enrol", label: "Inscriptions", Icon: IEnrol },
    { id: "reeng", label: "Relances", Icon: IReeng },
  ]},
  { group: "Pédagogie", items: [
    { id: "courses", label: "Cours", Icon: ICourse },
    { id: "eval", label: "Projets Bloc 4", Icon: IEval },
    { id: "certs", label: "Certificats", Icon: ICert },
  ]},
  { group: "Organisation", items: [
    { id: "entreprises", label: "Entreprises & licences", Icon: IOrg },
    { id: "orgs", label: "Cohortes & clients", Icon: IOrg },
    { id: "sessions", label: "Sessions live", Icon: ISession },
  ]},
  { group: "Système", items: [
    { id: "audit", label: "Journal d'audit", Icon: IAudit },
    { id: "settings", label: "Réglages", Icon: ISettings },
  ]},
];
const TITLES: Record<string, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])));

export type CourseCtx = { courses: CourseSummary[]; courseId: string; setCourseId: (id: string) => void };

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
      <img src="/logo-icon.png" alt="DECLICK DIGITAL" onError={(e) => (e.currentTarget.style.display = "none")} />
      <span className="wm">DECLICK <b>DIGITAL</b><span className="sub">ADMINISTRATION</span></span>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<Principal | null>(auth.user());
  const route = useHash();
  const go = (id: string) => { location.hash = `/${id}`; };

  // Course context (loaded once authenticated).
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  useEffect(() => {
    if (!user) return;
    api.courses().then((cs) => {
      setCourses(cs);
      const published = cs.find((c) => c.versions.some((v) => v.status === "PUBLISHED")) ?? cs[0];
      if (published) setCourseId(published.id);
    }).catch(() => {});
  }, [user]);
  const ctx = useMemo<CourseCtx>(() => ({ courses, courseId, setCourseId }), [courses, courseId]);

  const logout = () => { auth.clear(); setUser(null); };

  if (!user) return <Login onDone={() => setUser(auth.user())} />;

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
          <div className="av">{initials(user.name)}</div>
          <div className="who"><b>{user.name}</b><span>{user.role.replace(/_/g, " ").toLowerCase()}</span></div>
          <button className="logout" title="Déconnexion" onClick={logout}>⎋</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumbs">Administration <span style={{ margin: "0 6px", color: "var(--line-strong)" }}>/</span> <b>{TITLES[route] ?? "Tableau de bord"}</b></div>
          <div className="spacer" />
          <label className="search"><ISearch /><input placeholder="Rechercher un apprenant, une cohorte…" /></label>
        </header>
        {!courseId && route !== "settings" && route !== "entreprises" ? (
          <div className="content"><div className="card"><div className="card-b">Chargement des cours…</div></div></div>
        ) : route === "dashboard" ? <Dashboard ctx={ctx} />
          : route === "learners" ? <Learners ctx={ctx} />
          : route === "enrol" ? <Enrol ctx={ctx} />
          : route === "reeng" ? <Relances ctx={ctx} />
          : route === "audit" ? <Audit />
          : route === "entreprises" ? <Entreprises />
          : route === "orgs" ? <Orgs />
          : route === "sessions" ? <Sessions />
          : route === "eval" ? <Evaluation />
          : route === "certs" ? <Certificats />
          : route === "courses" ? <Cours ctx={ctx} />
          : route === "settings" ? <Settings />
          : <Soon title={TITLES[route] ?? "Module"} />}
      </div>
    </div>
  );
}
