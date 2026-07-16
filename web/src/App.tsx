import { Suspense, lazy, useEffect, useState } from "react";
import { api, engine, isLoggedIn, logout } from "./lib/app";
import { startAutoSync, type SyncState } from "./lib/autosync";
import { navigate, routes, useRoute, type Route } from "./lib/router";
import { brand, brandWordmark } from "./lib/brand";
import { Login } from "./ui/Login";
import { Enrollments } from "./ui/Enrollments";
import { InstallPrompt } from "./ui/InstallPrompt";
import { IconHome, IconBook, IconJournal, IconBadge, IconBell } from "./ui/icons";
import { useT } from "./lib/i18n";
import { LanguageSwitcher } from "./ui/LanguageSwitcher";
import { initNative, isNative, syncPushToken } from "./lib/native";

const Home = lazy(() => import("./ui/Home").then((m) => ({ default: m.Home })));
const Course = lazy(() => import("./ui/Course").then((m) => ({ default: m.Course })));
const Journal = lazy(() => import("./ui/Journal").then((m) => ({ default: m.Journal })));
const SessionScreen = lazy(() => import("./ui/Session").then((m) => ({ default: m.SessionScreen })));
const QuizScreen = lazy(() => import("./ui/QuizScreen").then((m) => ({ default: m.QuizScreen })));
const Deliverable = lazy(() => import("./ui/Deliverable").then((m) => ({ default: m.Deliverable })));
const Activity = lazy(() => import("./ui/Activity").then((m) => ({ default: m.Activity })));
const Project = lazy(() => import("./ui/Project").then((m) => ({ default: m.Project })));
const Badges = lazy(() => import("./ui/Badges").then((m) => ({ default: m.Badges })));
const Onboarding = lazy(() => import("./ui/Onboarding").then((m) => ({ default: m.Onboarding })));
const Account = lazy(() => import("./ui/Account").then((m) => ({ default: m.Account })));
const Revision = lazy(() => import("./ui/Revision").then((m) => ({ default: m.Revision })));

/** The eid of a course-scoped route (null on the enrolments list). */
function eidOf(route: Route): string | null {
  return "eid" in route ? route.eid : null;
}
/** Which bottom tab is active for the current route. */
function activeTab(route: Route): "home" | "cours" | "journal" | "badges" | null {
  switch (route.name) {
    case "course": case "onboarding": return "home";
    case "cours": case "session": case "quiz": case "deliverable": case "activity": case "project": return "cours";
    case "journal": return "journal";
    case "badges": return "badges";
    default: return null;
  }
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "course": return <Home eid={route.eid} />;
    case "cours": return <Course eid={route.eid} />;
    case "journal": return <Journal eid={route.eid} />;
    case "session": return <SessionScreen eid={route.eid} block={route.block} item={route.item} />;
    case "quiz": return <QuizScreen eid={route.eid} kind={route.kind} />;
    case "deliverable": return <Deliverable eid={route.eid} block={route.block} itemKey={route.key} />;
    case "activity": return <Activity eid={route.eid} block={route.block} itemKey={route.key} />;
    case "project": return <Project eid={route.eid} />;
    case "badges": return <Badges eid={route.eid} />;
    case "onboarding": return <Onboarding eid={route.eid} />;
    case "block": return <Course eid={route.eid} />;
    case "account": return <Account />;
    case "revision": return <Revision eid={route.eid} />;
    default: return <Enrollments />;
  }
}

const TABS = [
  { key: "home", label: "nav.home", Icon: IconHome, href: routes.course },
  { key: "cours", label: "nav.cours", Icon: IconBook, href: routes.cours },
  { key: "journal", label: "nav.journal", Icon: IconJournal, href: routes.journal },
  { key: "badges", label: "nav.badges", Icon: IconBadge, href: routes.badges },
] as const;

function Brand() {
  const t = useT();
  const wm = brandWordmark();
  return (
    <div className="brand" style={{ cursor: "pointer" }} onClick={() => navigate(routes.enrollments())} title={t("brand.myCourses")}>
      <img className="mark" src="/logo-icon.png" alt={brand.operator} />
      <span className="wm">{wm.head}{wm.accent ? <> <b>{wm.accent}</b></> : null}<span className="sub">{t("brand.operatedBy", { operator: brand.operator })}</span></span>
    </div>
  );
}

function Banner({ sync }: { sync: SyncState }) {
  const t = useT();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!online) return <div className="banner offline">{t("banner.offline")}</div>;
  if (sync === "syncing") return <div className="banner syncing">{t("banner.syncing")}</div>;
  return null;
}

export function App() {
  const t = useT();
  const [authed, setAuthed] = useState(isLoggedIn());
  const [sync, setSync] = useState<SyncState>("idle");
  const route = useRoute();

  useEffect(() => { document.title = brand.name; initNative(); }, []);
  useEffect(() => {
    if (!authed) return;
    syncPushToken();
    // The pull keeps this device in step with completions made elsewhere
    // (another device, same account) — no manual refresh needed.
    return startAutoSync(engine, (s) => setSync(s), 60_000, async (eid) => {
      try { const d = await api.progress(eid); return d?.progress ?? null; } catch { return null; }
    });
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const eid = eidOf(route);
  const tab = activeTab(route);
  const onLogout = () => { logout(); setAuthed(false); };

  // Enrolments list (no course context) — simple centered layout.
  if (!eid) {
    return (
      <div className="shell">
        <div className="main">
          <div className="appbar appbar--standalone"><Brand /><div className="tools"><LanguageSwitcher /><button className="hf-btn hf-btn--ghost hf-btn--sm" onClick={() => navigate(routes.account())}>{t("nav.account")}</button><button className="hf-btn hf-btn--ghost" onClick={onLogout}>{t("nav.logout")}</button></div></div>
          <main className="screen"><Banner sync={sync} />{!isNative() && <InstallPrompt />}<Suspense fallback={<div className="skeleton card" />}><Screen route={route} /></Suspense></main>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <Brand />
        {TABS.map(({ key, label, Icon, href }) => (
          <button key={key} className={`navitem ${tab === key ? "on" : ""}`} onClick={() => navigate(href(eid))}>
            <Icon /> {t(label)}
          </button>
        ))}
        <div className="spacer" />
        <button className="navitem" onClick={() => navigate(routes.account())}>{t("nav.account")}</button>
        <button className="navitem" onClick={onLogout}>{t("nav.logout")}</button>
        <div style={{ padding: "8px 12px" }}><LanguageSwitcher /></div>
      </aside>

      <div className="main">
        {/* Mobile appbar */}
        <header className="appbar">
          <Brand />
          <div className="tools">
            <LanguageSwitcher compact />
            <span className="iconbtn" aria-label={t("a11y.notifications")}><IconBell size={18} /></span>
            <button className="hf-btn hf-btn--ghost hf-btn--sm" onClick={() => navigate(routes.account())}>{t("nav.account")}</button>
            <button className="hf-btn hf-btn--ghost hf-btn--sm" onClick={onLogout}>{t("nav.logout")}</button>
          </div>
        </header>

        <main className="screen">
          <Banner sync={sync} />
          {!isNative() && <InstallPrompt />}
          <Suspense fallback={<div className="skeleton card" />}><Screen route={route} /></Suspense>
        </main>

        {/* Mobile bottom tabs */}
        {tab && (
          <nav className="tabbar">
            {TABS.map(({ key, label, Icon, href }) => (
              <button key={key} className={`tab ${tab === key ? "on" : ""}`} onClick={() => navigate(href(eid))}>
                <Icon /> {t(label)}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
