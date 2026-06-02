import { useState } from "react";
import { isLoggedIn, logout } from "./lib/app";
import { Login } from "./ui/Login";
import { Course } from "./ui/Course";

export function App() {
  const [authed, setAuthed] = useState(isLoggedIn());
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return (
    <div className="app">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <strong>Kompetences Declick</strong>
        <button onClick={() => { logout(); setAuthed(false); }}>Déconnexion</button>
      </header>
      <Course />
    </div>
  );
}
