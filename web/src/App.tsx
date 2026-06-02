import { Suspense, lazy, useEffect, useState } from "react";
import { engine, isLoggedIn, logout } from "./lib/app";
import { startAutoSync, type SyncState } from "./lib/autosync";
import { useRoute } from "./lib/router";
import { Login } from "./ui/Login";
import { Enrollments } from "./ui/Enrollments";

// Route-level code splitting: the dashboard entry stays in the main chunk; the
// heavier flows (player + media, quizzes, project, onboarding…) load on demand,
// keeping first paint small on low-spec / 3G devices (AC#16).
const Course = lazy(() => import("./ui/Course").then((m) => ({ default: m.Course })));
const SessionScreen = lazy(() => import("./ui/Session").then((m) => ({ default: m.SessionScreen })));
const QuizScreen = lazy(() => import("./ui/QuizScreen").then((m) => ({ default: m.QuizScreen })));
const Deliverable = lazy(() => import("./ui/Deliverable").then((m) => ({ default: m.Deliverable })));
const Project = lazy(() => import("./ui/Project").then((m) => ({ default: m.Project })));
const Badges = lazy(() => import("./ui/Badges").then((m) => ({ default: m.Badges })));
const Onboarding = lazy(() => import("./ui/Onboarding").then((m) => ({ default: m.Onboarding })));

function Screen() {
  const route = useRoute();
  switch (route.name) {
    case "course": return <Course eid={route.eid} />;
    case "session": return <SessionScreen eid={route.eid} block={route.block} item={route.item} />;
    case "quiz": return <QuizScreen eid={route.eid} kind={route.kind} />;
    case "deliverable": return <Deliverable eid={route.eid} block={route.block} itemKey={route.key} />;
    case "project": return <Project eid={route.eid} />;
    case "badges": return <Badges eid={route.eid} />;
    case "onboarding": return <Onboarding eid={route.eid} />;
    // block detail screen lands in a later phase; fall back to the dashboard.
    case "block": return <Course eid={route.eid} />;
    default: return <Enrollments />;
  }
}

function ConnectivityBanner({ sync }: { sync: SyncState }) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!online) return <div className="banner offline">⚠️ Hors-ligne — votre progression est enregistrée et se synchronisera automatiquement.</div>;
  if (sync === "syncing") return <div className="banner syncing">⟳ Synchronisation…</div>;
  return null;
}

export function App() {
  const [authed, setAuthed] = useState(isLoggedIn());
  const [sync, setSync] = useState<SyncState>("idle");

  useEffect(() => {
    if (!authed) return;
    return startAutoSync(engine, (s) => setSync(s));
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <>
      <div className="appbar">
        <strong>Kompetences Declick</strong>
        <button className="ghost" onClick={() => { logout(); setAuthed(false); }}>Déconnexion</button>
      </div>
      <main className="app">
        <ConnectivityBanner sync={sync} />
        <Suspense fallback={<div className="skeleton card" style={{ height: 120 }} />}>
          <Screen />
        </Suspense>
      </main>
    </>
  );
}
