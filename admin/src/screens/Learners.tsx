import { useMemo, useState } from "react";
import { api, auth, courseTitle, type LearnerRow } from "../lib/api";
import { avatarColor, initials, ago, useAsync } from "../lib/ui";

const CAN_MANAGE = ["SUPER_ADMIN", "COURSE_ADMIN"];
import type { CourseCtx } from "../App";

function statusPill(l: LearnerRow) {
  if (l.status === "CERTIFIED") return <span className="pill pill--green"><span className="dot" />Certifié</span>;
  if (l.active) return <span className="pill pill--navy"><span className="dot" />En cours</span>;
  return <span className="pill pill--red"><span className="dot" />Inactif</span>;
}
function b4Pill(l: LearnerRow) {
  if (l.status === "CERTIFIED") return <span className="pill pill--green">Validé</span>;
  if (l.rubric != null) return <span className="pill pill--navy">Évalué · {l.rubric}%</span>;
  return <span className="muted">—</span>;
}

export function Learners({ ctx }: { ctx: CourseCtx }) {
  const { courseId, courses, setCourseId } = ctx;
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsync<LearnerRow[]>(() => api.courseLearners(courseId), [courseId, reloadKey]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("Tous");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const canManage = CAN_MANAGE.includes(auth.user()?.role ?? "");

  // Re-point the enrolment to the latest published version (so new videos/edits
  // show up). "full" wipes progress, "version" keeps it. Never deletes the account.
  async function resetCourse(l: LearnerRow, mode: "full" | "version") {
    const msg = mode === "full"
      ? `Réinitialiser le parcours de ${l.email} ?\nLa progression est remise à zéro ET l'inscription repasse à la dernière version publiée (nouvelles vidéos/modifs). Le compte n'est pas supprimé.`
      : `Mettre à jour ${l.email} vers la dernière version publiée ?\nLa progression est conservée ; seules les nouvelles vidéos/modifications apparaissent.`;
    if (!window.confirm(msg)) return;
    setBusyId(l.id); setNote(null);
    try { const r = await api.resetEnrollment(l.enrollmentId, mode); setNote(`✅ ${l.email} — ${mode === "full" ? "parcours réinitialisé" : "mis à jour"} (version ${r.version}).`); setReloadKey((k) => k + 1); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }

  async function resend(l: LearnerRow) {
    setBusyId(l.id); setNote(null);
    try {
      const r = await api.invite(l.id);
      setNote(r.delivered
        ? `✅ Invitation renvoyée à ${l.email}. Nouveau mot de passe : ${r.tempPassword}`
        : `⚠️ Aucun canal d'envoi configuré (SMTP) — l'invitation n'a PAS été délivrée. Nouveau mot de passe à communiquer manuellement : ${r.tempPassword}`);
    } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }

  const rows = useMemo(() => (data ?? []).filter((l) =>
    (filter === "Tous" || (filter === "Certifiés" && l.status === "CERTIFIED") || (filter === "En cours" && l.active && l.status !== "CERTIFIED") || (filter === "Inactifs" && !l.active && l.status !== "CERTIFIED")) &&
    (q === "" || (l.name + l.email).toLowerCase().includes(q.toLowerCase()))
  ), [data, q, filter]);

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{loading ? "…" : `${rows.length} apprenant${rows.length > 1 ? "s" : ""}`}</div>
          <h1>Apprenants</h1>
          <div className="sub">{courses.find((c) => c.id === courseId) ? courseTitle(courses.find((c) => c.id === courseId)!) : ""}</div>
        </div>
        <div className="filters">
          <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>{courses.map((c) => <option key={c.id} value={c.id}>{courseTitle(c)}</option>)}</select>
          {canManage && <a href="#/enrol" className="btn btn--primary">+ Inscrire un apprenant</a>}
        </div>
      </div>

      {note && <div className="card" style={{ background: (note.startsWith("✅") || note.startsWith("🗑️")) ? "var(--success-tint)" : "var(--warning-tint)", border: "none", padding: "11px 14px", marginBottom: 14, fontSize: 13 }} onClick={() => setNote(null)}>{note}</div>}

      <div className="card">
        <div className="card-h" style={{ paddingBottom: 14, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <label className="search" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", padding: "8px 14px", width: 300 }}>
            <input style={{ border: 0, background: "none", outline: "none", fontFamily: "inherit", fontSize: 13, width: "100%" }} placeholder="Rechercher par nom ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}><option>Tous</option><option>En cours</option><option>Inactifs</option><option>Certifiés</option></select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Apprenant</th><th>Progression</th><th>Quiz final</th><th>Projet B4</th><th>Dernière activité</th><th>Statut</th>{canManage && <th>Actions</th>}</tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.email}>
                  <td><div className="uitem"><span className="av" style={{ background: avatarColor(l.name) }}>{initials(l.name)}</span><div className="who"><b>{l.name}</b><span>{l.email}</span></div></div></td>
                  <td><div className="progress"><div className="track"><i style={{ width: `${l.progressPercent}%`, background: l.progressPercent === 100 ? "var(--green)" : "var(--orange-500)" }} /></div><span className="pct">{l.progressPercent}%</span></div></td>
                  <td>{l.finalQuiz != null ? <span className="pill pill--soft">{l.finalQuiz}%</span> : <span className="muted">—</span>}</td>
                  <td>{b4Pill(l)}</td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>{ago(l.lastActivity)}</span></td>
                  <td>{statusPill(l)}</td>
                  {canManage && (
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn btn--sm" disabled={busyId === l.id} onClick={() => resend(l)} title="Réinitialise le mot de passe et renvoie l'invitation">{busyId === l.id ? "…" : "↻ Renvoyer"}</button>
                        <button className="btn btn--sm" disabled={busyId === l.id} onClick={() => resetCourse(l, "version")} title="Mettre à jour vers la dernière version publiée (garde la progression)">⟳ Maj version</button>
                        <button className="btn btn--sm" disabled={busyId === l.id} onClick={() => resetCourse(l, "full")} title="Réinitialiser le parcours (remet la progression à zéro + dernière version)" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>↺ Réinitialiser</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="empty">Chargement des apprenants…</div>}
          {error && <div className="empty" style={{ color: "var(--danger)" }}>Erreur : {error}</div>}
          {!loading && !error && rows.length === 0 && <div className="empty"><div className="big">👤</div>Aucun apprenant inscrit à ce parcours. Utilisez « Inscrire un apprenant ».</div>}
        </div>
      </div>
    </div>
  );
}
