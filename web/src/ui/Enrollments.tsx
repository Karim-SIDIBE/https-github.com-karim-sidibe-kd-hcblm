import { useEffect, useState } from "react";
import { api } from "../lib/app";
import type { EnrollmentSummary } from "../lib/api";
import { knownEnrollments, rememberEnrollment } from "../lib/autosync";
import { navigate, routes } from "../lib/router";

const LEVELS: Record<string, string> = { N1: "Niveau 1", N2: "Niveau 2", N3: "Niveau 3" };

export function Enrollments() {
  const [list, setList] = useState<EnrollmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.listEnrollments()
      .then((rows) => { if (alive) { setList(rows); rows.forEach((r) => rememberEnrollment(r.id)); } })
      .catch(() => { if (alive) setError("Impossible de charger vos parcours (hors-ligne ?)."); });
    return () => { alive = false; };
  }, []);

  function open(id: string) { rememberEnrollment(id); navigate(routes.course(id)); }

  if (error && !list) {
    const known = knownEnrollments();
    return (
      <div>
        <h1>Mes parcours</h1>
        <p className="banner offline">⚠️ {error}</p>
        {known.length > 0 && (
          <div className="stack">
            <p className="muted">Parcours disponibles hors-ligne :</p>
            {known.map((id) => (
              <button key={id} className="block secondary" onClick={() => open(id)}>Ouvrir {id.slice(0, 8)}…</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!list) {
    return (
      <div>
        <h1>Mes parcours</h1>
        {[0, 1].map((i) => <div key={i} className="card"><div className="skeleton line" style={{ width: "60%" }} /><div className="skeleton card" /></div>)}
      </div>
    );
  }

  if (list.length === 0) {
    return <div><h1>Mes parcours</h1><p className="muted">Aucune inscription pour le moment.</p></div>;
  }

  return (
    <div>
      <h1>Mes parcours</h1>
      <div className="stack">
        {list.map((e) => (
          <article key={e.id} className="card tappable" onClick={() => open(e.id)} role="button" tabIndex={0}
            onKeyDown={(k) => { if (k.key === "Enter") open(e.id); }}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>{e.course.title}</h2>
              <span className={`chip ${e.status === "CERTIFIED" ? "ok" : ""}`}>{e.status === "CERTIFIED" ? "Certifié 🎓" : LEVELS[e.course.level] ?? e.course.level}</span>
            </div>
            <div className="progress" style={{ margin: "10px 0 6px" }}><span style={{ width: `${e.progressPercent}%` }} /></div>
            <p className="muted" style={{ margin: 0 }}>{e.blocksCompleted}/{e.blocksTotal} blocs · {e.progressPercent}%</p>
          </article>
        ))}
      </div>
    </div>
  );
}
