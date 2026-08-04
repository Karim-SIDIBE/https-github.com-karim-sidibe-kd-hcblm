import { useEffect, useMemo, useState } from "react";
import {
  IDash, ILearners, IEnrol, IReeng, ICourse, IEval, ICert, IOrg, ISession, IAudit, ISettings, ISearch,
} from "./icons";
import { auth, api, logoutEverywhere, type CourseSummary, type Principal } from "./lib/api";
import { initials } from "./lib/ui";
import { Login } from "./screens/Login";
import { ModalHost } from "./lib/modal";
import { Dashboard } from "./screens/Dashboard";
import { Insights } from "./screens/Insights";
import { Learners } from "./screens/Learners";
import { Enrol } from "./screens/Enrol";
import { Relances } from "./screens/Relances";
import { Audit } from "./screens/Audit";
import { Orgs } from "./screens/Orgs";
import { Entreprises } from "./screens/Entreprises";
import { Utilisateurs } from "./screens/Utilisateurs";
import { Sessions } from "./screens/Sessions";
import { Evaluation } from "./screens/Evaluation";
import { Certificats } from "./screens/Certificats";
import { Cours } from "./screens/Cours";
import { Medias } from "./screens/Medias";
import { QuestionBank } from "./screens/QuestionBank";
import { Settings } from "./screens/Settings";
import { UiTexts } from "./screens/UiTexts";
import { Security } from "./screens/Security";
import { Jobs } from "./screens/Jobs";
import { Webhooks } from "./screens/Webhooks";
import { twofa } from "./lib/api";

type NavItem = { id: string; label: string; Icon: () => JSX.Element; roles: string[]; soon?: boolean };
const A = "SUPER_ADMIN", C = "COURSE_ADMIN", I = "INSTRUCTOR", E = "EVALUATOR", D = "LEARNING_DESIGNER", R = "REVIEWER", EC = "ENTERPRISE_CLIENT", EM = "EMPLOYER";
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Pilotage", items: [
    { id: "dashboard", label: "Tableau de bord", Icon: IDash, roles: [A, C, I, E, EC, EM] },
    // LEARNING_DESIGNER exclu : pas de permission analytics:read côté serveur.
    { id: "insights", label: "Pilotage pédagogique", Icon: IDash, roles: [A, C, I] },
    { id: "learners", label: "Apprenants", Icon: ILearners, roles: [A, C, I, E] },
    { id: "users", label: "Utilisateurs", Icon: ILearners, roles: [A, C] },
    { id: "enrol", label: "Inscriptions", Icon: IEnrol, roles: [A, C] },
    { id: "reeng", label: "Relances", Icon: IReeng, roles: [A, C] },
  ]},
  { group: "Pédagogie", items: [
    { id: "courses", label: "Cours", Icon: ICourse, roles: [A, C, D, R] },
    { id: "medias", label: "Médiathèque", Icon: ISession, roles: [A, C, D] },
    { id: "bank", label: "Banque de questions", Icon: ICourse, roles: [A, C, D, R] },
    { id: "eval", label: "Projets Bloc 4", Icon: IEval, roles: [A, C, E] },
    { id: "certs", label: "Certificats", Icon: ICert, roles: [A, C] },
  ]},
  { group: "Organisation", items: [
    { id: "entreprises", label: "Entreprises & licences", Icon: IOrg, roles: [A, C] },
    { id: "orgs", label: "Cohortes & clients", Icon: IOrg, roles: [A, C, I] },
    { id: "sessions", label: "Sessions live", Icon: ISession, roles: [A, C, I] },
  ]},
  { group: "Système", items: [
    { id: "uitexts", label: "Textes de l'interface", Icon: ISettings, roles: [A] },
    { id: "audit", label: "Journal d'audit", Icon: IAudit, roles: [A, C] },
    { id: "jobs", label: "Jobs & planification", Icon: ISettings, roles: [A, C] },
    { id: "webhooks", label: "Webhooks", Icon: ISettings, roles: [A, C] },
    { id: "security", label: "Sécurité (2FA)", Icon: ISettings, roles: [A, C, I, E, D, R, EC, EM] },
    { id: "settings", label: "Réglages", Icon: ISettings, roles: [A, C] },
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

  // Staff-2FA policy (M3): when enabled and this privileged account has no
  // TOTP, show a persistent banner and land on the Security screen once.
  const [need2fa, setNeed2fa] = useState(false);
  const [twofaTick, setTwofaTick] = useState(0);
  useEffect(() => {
    const on = () => setTwofaTick((t) => t + 1); // Security dispatches after enabling
    window.addEventListener("kd-2fa-changed", on);
    return () => window.removeEventListener("kd-2fa-changed", on);
  }, []);
  useEffect(() => {
    if (!user || !["SUPER_ADMIN", "COURSE_ADMIN"].includes(user.role)) { setNeed2fa(false); return; }
    Promise.all([api.settings().catch(() => ({}) as Record<string, unknown>), twofa.status().catch(() => ({ enabled: true }))])
      .then(([s, st]) => {
        const required = s["require_staff_2fa"] === true && !st.enabled;
        setNeed2fa(required);
        if (required && twofaTick === 0) location.hash = "/security";
      });
  }, [user, twofaTick]);

  // Role-aware navigation: each role sees only its modules + a default landing.
  const nav = useMemo(() => {
    const r = user?.role ?? "";
    return NAV.map((g) => ({ ...g, items: g.items.filter((it) => it.roles.includes(r)) })).filter((g) => g.items.length > 0);
  }, [user]);
  const allowedIds = useMemo(() => new Set(nav.flatMap((g) => g.items.map((i) => i.id))), [nav]);
  const defaultId = nav[0]?.items[0]?.id ?? "settings";
  const view = allowedIds.has(route) ? route : defaultId;
  useEffect(() => { if (user && !allowedIds.has(route)) location.hash = `/${defaultId}`; }, [user, route, allowedIds, defaultId]);

  const logout = () => { void logoutEverywhere(); setUser(null); };

  if (!user) return <Login onDone={() => setUser(auth.user())} />;

  return (
    <div className="app">
      <ModalHost />
      <aside className="sidebar">
        <Brand />
        <nav>
          {nav.map((g) => (
            <div className="navgroup" key={g.group}>
              <div className="label">{g.group}</div>
              {g.items.map(({ id, label, Icon, soon }) => (
                <button key={id} className={`navitem ${view === id ? "on" : ""}`} onClick={() => go(id)}>
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
        {need2fa && (
          <div style={{ background: "var(--warning-tint, #FFF3E8)", borderBottom: "1px solid var(--line)", padding: "9px 20px", fontSize: 13, fontWeight: 600 }}>
            🔐 La politique de sécurité exige la double authentification (2FA) pour votre rôle — <a href="#/security" style={{ textDecoration: "underline" }}>activez-la maintenant</a>.
          </div>
        )}
        <header className="topbar">
          <div className="crumbs">Administration <span style={{ margin: "0 6px", color: "var(--line-strong)" }}>/</span> <b>{TITLES[view] ?? "Tableau de bord"}</b></div>
          <div className="spacer" />
          <label className="search"><ISearch />
            {/* Entrée → écran Apprenants avec le filtre prérempli (écouté par Learners). */}
            <input placeholder="Rechercher un apprenant… (Entrée)" onKeyDown={(e) => {
              if (e.key === "Enter") {
                const value = (e.target as HTMLInputElement).value.trim();
                go("learners");
                setTimeout(() => window.dispatchEvent(new CustomEvent("kd-admin-search", { detail: value })), 50);
              }
            }} />
          </label>
        </header>
        {!courseId && view !== "settings" && view !== "security" && view !== "entreprises" && view !== "users" && view !== "courses" && view !== "medias" && view !== "uitexts" ? (
          <div className="content"><div className="card"><div className="card-b">Chargement des cours…</div></div></div>
        ) : view === "dashboard" ? <Dashboard ctx={ctx} />
          : view === "insights" ? <Insights ctx={ctx} />
          : view === "users" ? <Utilisateurs />
          : view === "learners" ? <Learners ctx={ctx} />
          : view === "enrol" ? <Enrol ctx={ctx} />
          : view === "reeng" ? <Relances ctx={ctx} />
          : view === "audit" ? <Audit />
          : view === "entreprises" ? <Entreprises />
          : view === "orgs" ? <Orgs ctx={ctx} />
          : view === "sessions" ? <Sessions ctx={ctx} />
          : view === "eval" ? <Evaluation />
          : view === "certs" ? <Certificats />
          : view === "courses" ? <Cours ctx={ctx} />
          : view === "medias" ? <Medias />
          : view === "bank" ? <QuestionBank />
          : view === "uitexts" ? <UiTexts />
          : view === "jobs" ? <Jobs />
          : view === "webhooks" ? <Webhooks />
          : view === "settings" ? <Settings />
          : view === "security" ? <Security />
          : <Dashboard ctx={ctx} />}
      </div>
    </div>
  );
}
