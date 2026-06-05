import { useEffect, useState } from "react";
import { api } from "../lib/app";
import type { EnrollmentSummary, CatalogItem } from "../lib/api";
import { knownEnrollments, rememberEnrollment } from "../lib/autosync";
import { navigate, routes } from "../lib/router";

const LEVELS: Record<string, string> = { N1: "Niveau 1", N2: "Niveau 2", N3: "Niveau 3" };
const levelLabel = (l: string) => LEVELS[l] ?? l;

export function Enrollments() {
  const [list, setList] = useState<EnrollmentSummary[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await api.listEnrollments();
      setList(rows); rows.forEach((r) => rememberEnrollment(r.id));
    } catch { setError("Impossible de charger vos parcours (hors-ligne ?)."); }
    try { setCatalog(await api.catalog()); } catch { /* catalogue needs network */ }
  }
  useEffect(() => { void load(); }, []);

  function open(id: string) { rememberEnrollment(id); navigate(routes.course(id)); }

  async function enroll(c: CatalogItem) {
    setEnrolling(c.courseId); setError(null);
    try { const e = await api.selfEnroll(c.courseId); rememberEnrollment(e.id); navigate(routes.course(e.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Inscription impossible"); }
    finally { setEnrolling(null); }
  }

  // Offline fallback (no enrolment list loaded).
  if (error && !list) {
    const known = knownEnrollments();
    return (
      <div>
        <h1>Mes parcours</h1>
        <p className="banner offline">⚠️ {error}</p>
        {known.length > 0 && (
          <div className="stack">
            <p className="muted">Parcours disponibles hors-ligne :</p>
            {known.map((id) => <button key={id} className="block secondary" onClick={() => open(id)}>Ouvrir {id.slice(0, 8)}…</button>)}
          </div>
        )}
      </div>
    );
  }

  if (!list) {
    return <div><h1>Mes parcours</h1>{[0, 1].map((i) => <div key={i} className="card"><div className="skeleton line" style={{ width: "60%" }} /><div className="skeleton card" /></div>)}</div>;
  }

  const available = catalog.filter((c) => !c.enrolled);

  return (
    <div className="stack">
      <div>
        <h1>Mes parcours</h1>
        {list.length === 0
          ? <p className="muted">Vous n'êtes encore inscrit·e à aucun parcours. Choisissez-en un ci-dessous 👇</p>
          : (
            <div className="stack">
              {list.map((e) => (
                <article key={e.id} className="card tappable" onClick={() => open(e.id)} role="button" tabIndex={0}
                  onKeyDown={(k) => { if (k.key === "Enter") open(e.id); }}>
                  <div className="row between">
                    <h2 style={{ margin: 0 }}>{e.course.title}</h2>
                    <span className={`chip ${e.status === "CERTIFIED" ? "ok" : ""}`}>{e.status === "CERTIFIED" ? "Certifié 🎓" : levelLabel(e.course.level)}</span>
                  </div>
                  <div className="progress" style={{ margin: "10px 0 6px" }}><span style={{ width: `${e.progressPercent}%` }} /></div>
                  <p className="muted" style={{ margin: 0 }}>{e.blocksCompleted}/{e.blocksTotal} blocs · {e.progressPercent}%</p>
                </article>
              ))}
            </div>
          )}
      </div>

      {available.length > 0 && (
        <div>
          <h2 style={{ marginBottom: 4 }}>Parcours disponibles</h2>
          <p className="muted" style={{ marginTop: 0 }}>Inscrivez-vous en un clic.</p>
          {error && list && <p className="banner offline">⚠️ {error}</p>}
          <div className="stack">
            {available.map((c) => (
              <article key={c.courseId} className="card">
                <div className="row between">
                  <h3 style={{ margin: 0 }}>{c.title}</h3>
                  <span className="chip">{levelLabel(c.level)}</span>
                </div>
                <button className="block" style={{ marginTop: 10 }} disabled={enrolling === c.courseId} onClick={() => enroll(c)}>
                  {enrolling === c.courseId ? "Inscription…" : "S'inscrire →"}
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
