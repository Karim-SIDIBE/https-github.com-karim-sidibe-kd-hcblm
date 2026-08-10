import { useEffect, useMemo, useState } from "react";
import { api, auth, type Accreditation, type EvalQueueItem, type ProjectDetail, type RubricSuggestion, type UserRow } from "../lib/api";
import { avatarColor, initials, ago, useAsync } from "../lib/ui";
import { modal } from "../lib/modal";

/** Roles allowed to be picked as evaluator of a Bloc 4 project. */
const EVALUATOR_ROLES = new Set(["EVALUATOR", "COURSE_ADMIN", "SUPER_ADMIN"]);

const STATUS: Record<string, { cls: string; label: string }> = {
  SUBMITTED: { cls: "pill--warn", label: "À attribuer" },
  ASSIGNED: { cls: "pill--info", label: "En évaluation" },
  PASSED: { cls: "pill--green", label: "Certifié" },
  REVISION_REQUESTED: { cls: "pill--red", label: "Remise demandée" },
  NOT_CERTIFIED: { cls: "pill--red", label: "Non certifié" },
};

function GradeDrawer({ item, onClose, onDone }: { item: EvalQueueItem; onClose: () => void; onDone: () => void }) {
  const me = auth.user();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [points, setPoints] = useState<number[]>(() => (item.rubric?.criteria ?? []).map(() => 0));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"" | "assign" | "grade" | "ai">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [evaluators, setEvaluators] = useState<UserRow[]>([]);
  const [pick, setPick] = useState("");
  const [ai, setAi] = useState<RubricSuggestion | null>(null);

  useEffect(() => { api.project(item.enrollmentId).then(setDetail).catch(() => setDetail(null)); }, [item.enrollmentId]);
  useEffect(() => {
    api.users().then((us) => setEvaluators(us.filter((u) => EVALUATOR_ROLES.has(u.role) && !u.disabled))).catch(() => {});
  }, []);

  const crit = item.rubric?.criteria ?? [];
  const banded = crit.some((c) => (c.bands ?? []).length > 0);
  const [evidence, setEvidence] = useState<string[]>(() => crit.map(() => ""));
  const maxTotal = crit.reduce((s, c) => s + c.weightPoints, 0) || 100;
  const total = points.reduce((s, p) => s + p, 0);
  const threshold = item.rubric?.threshold ?? 70;
  const sections = detail?.content?.sections ?? {};
  // Décision du socle §6, prévisualisée en direct (mêmes règles que le serveur).
  const minimumsMissed = crit.filter((c, i) => c.minPoints != null && (points[i] ?? 0) < c.minPoints).map((c) => c.label);
  const decision = minimumsMissed.length >= 2 || total < 55 ? "NOT_CERTIFIED"
    : total >= threshold && minimumsMissed.length === 0 ? "CERTIFIED" : "RESUBMIT";

  const [f2f, setF2f] = useState(false);
  async function assign(evaluatorId: string) {
    setBusy("assign"); setMsg(null);
    // Déclaration FACE2FACE (socle §5.1) : cochée = incompatibilité déclarée,
    // le serveur refuse et le dossier doit partir à un autre évaluateur.
    try { await api.assignEvaluator(item.enrollmentId, evaluatorId, f2f); setMsg("Projet attribué (déclaration FACE2FACE : aucun lien)."); onDone(); } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(""); }
  }
  async function suggest() {
    setBusy("ai"); setMsg(null);
    try {
      const s = await api.rubricSuggestion(item.enrollmentId);
      setAi(s);
    } catch (e: any) { setMsg(e?.message || "Suggestion indisponible"); }
    finally { setBusy(""); }
  }
  function applySuggestion() {
    if (!ai) return;
    // Align by label (the service returns the rubric's own labels, clamped).
    setPoints(crit.map((c) => ai.perCriterion.find((s) => s.label === c.label)?.suggested ?? 0));
  }
  async function grade() {
    if (banded && evidence.some((e) => !e.trim())) { setMsg("Preuve manquante : chaque critère exige une citation exacte ou une déclaration d'absence (règle 3 du socle)."); return; }
    setBusy("grade"); setMsg(null);
    try {
      await api.gradeProject(item.enrollmentId, { criteria: points.map((p, i) => ({ index: i, points: p, evidence: evidence[i]?.trim() || undefined })), notes: notes.trim() || undefined });
      const label = decision === "CERTIFIED" ? "certifié" : decision === "RESUBMIT" ? "remise demandée" : "non certifié";
      setMsg(`Décision enregistrée : ${total}/100 — ${label}.`);
      onDone();
    } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(""); }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="dh">
          <div>
            <div className="eyebrow">Projet Bloc 4</div>
            <h2>{item.learner.name}</h2>
            <span className="muted" style={{ fontSize: 12.5 }}>{item.learner.email} · soumis {ago(item.submittedAt).toLowerCase()}</span>
          </div>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="db">
          {item.journal && (
            // Part calculée par la plateforme du critère S1 (socle §3) : l'évaluateur
            // ne relit pas le calendrier — il note le signal de surcharge et l'ajustement.
            <div className="card" style={{ padding: "10px 12px", marginBottom: 12 }}>
              <div className="row between">
                <strong style={{ fontSize: 13 }}>Journal de pratique — donnée plateforme (critère S1)</strong>
                <span className={`pill pill--sm ${item.journal.completed === item.journal.expected ? "pill--green" : item.journal.completed >= 4 ? "pill--warn" : "pill--red"}`}>
                  {item.journal.completed}/{item.journal.expected} entrées
                </span>
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                {item.journal.entries.map((e) => `J+${e.day} : ${e.completedAt ? new Date(e.completedAt).toLocaleDateString("fr-FR") : "—"}`).join(" · ")}
                {item.journal.groupedCatchup && <span style={{ color: "var(--red, #b91c1c)" }}> · ⚠️ rattrapage groupé (plus de 2 entrées le même jour)</span>}
              </div>
            </div>
          )}
          <div className="row between" style={{ marginBottom: 14 }}>
            <span className={`pill ${(STATUS[item.revisionStatus] ?? { cls: "pill--soft" }).cls}`}>{(STATUS[item.revisionStatus] ?? { label: item.revisionStatus }).label}</span>
            {item.evaluator ? <span className="muted" style={{ fontSize: 12.5 }}>Évaluateur : {item.evaluator.name}</span> : (
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="btn btn--sm" disabled={busy === "assign"} onClick={() => me && void assign(me.id)}>{busy === "assign" ? "…" : "M'attribuer"}</button>
                <select className="select" value={pick} onChange={(e) => { setPick(e.target.value); if (e.target.value) void assign(e.target.value); }}>
                  <option value="">Attribuer à…</option>
                  {evaluators.filter((u) => u.id !== me?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </span>
            )}
          </div>
          {(item.revisionStatus === "SUBMITTED" || !item.evaluator) && (
            <label className="row" style={{ gap: 8, alignItems: "flex-start", fontSize: 12, marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={f2f} onChange={(e) => setF2f(e.target.checked)} style={{ marginTop: 2 }} />
              <span className="muted">Déclaration FACE2FACE (§5.1 du socle) : cochez si l'évaluateur pressenti a animé une session FACE2FACE suivie par ce candidat sur la même compétence — l'assignation sera refusée et archivée.</span>
            </label>
          )}

          <div className="eyebrow" style={{ marginBottom: 8 }}>Copie de l'apprenant</div>
          {Object.keys(sections).length === 0 ? <p className="muted" style={{ fontSize: 13 }}>{detail ? "Aucune section." : "Chargement…"}</p>
            : Object.entries(sections).map(([title, body]) => (
              <div className="section" key={title}><h4>{title}</h4><p>{body}</p></div>
            ))}

          <div className="eyebrow" style={{ margin: "20px 0 6px" }}>Grille d'évaluation</div>
          {crit.length > 0 && !ai && (
            <button className="btn btn--sm btn--ghost" disabled={busy === "ai"} onClick={suggest} style={{ marginBottom: 8 }}>
              {busy === "ai" ? "Analyse du projet…" : "✨ Suggestion de note (IA, indicative)"}
            </button>
          )}
          {ai && (
            <div className="card" style={{ marginBottom: 10, background: "var(--bg)" }}>
              <div className="card-b" style={{ fontSize: 12.5 }}>
                <b>✨ Suggestion {ai.aiGenerated ? "IA" : "automatique"} : {ai.suggestedTotal}/100</b> — {ai.summary}
                <ul style={{ margin: "6px 0 8px", paddingLeft: 18 }}>
                  {ai.perCriterion.map((s) => <li key={s.label}>{s.label} : <b>{s.suggested}/{s.weightPoints}</b> — {s.comment}</li>)}
                </ul>
                <button className="btn btn--sm" onClick={applySuggestion}>Préremplir la grille avec ces notes</button>
                <span className="muted" style={{ marginLeft: 8 }}>La décision reste humaine : ajustez avant d'enregistrer.</span>
              </div>
            </div>
          )}
          {crit.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Grille indisponible.</p> : (<>
            {banded && <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>Notation PAR BANDE (socle §5) : choisissez la bande la plus haute dont <b>tous</b> les éléments sont satisfaits — milieu de bande par défaut. La preuve (citation exacte ou déclaration d'absence) est obligatoire pour chaque critère.</p>}
            {crit.map((c, i) => (
              <div className="crit" key={c.label} style={{ display: "block" }}>
                <div className="row between" style={{ gap: 8 }}>
                  <div className="lab">
                    {c.label}
                    <small>sur {c.weightPoints} pts{c.minPoints != null ? ` · minimum ${c.minPoints}` : ""}{c.origin ? ` · ${c.origin}` : ""}</small>
                    {c.whereToLook ? <small style={{ display: "block" }}>Où chercher : {c.whereToLook}</small> : null}
                  </div>
                  <div className="row" style={{ justifyContent: "flex-end", gap: 6, flexShrink: 0 }}>
                    <input type="number" min={0} max={c.weightPoints} value={points[i]}
                      onChange={(e) => setPoints((p) => p.map((v, j) => j === i ? Math.max(0, Math.min(c.weightPoints, Number(e.target.value) || 0)) : v))} />
                    <span className="max">/ {c.weightPoints}</span>
                  </div>
                </div>
                {(c.bands ?? []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "6px 0 4px" }}>
                    {[...c.bands!].sort((a, b) => b.band - a.band).map((b) => {
                      const active = points[i]! >= b.scoreRange[0] && points[i]! <= b.scoreRange[1];
                      const mid = Math.ceil((b.scoreRange[0] + b.scoreRange[1]) / 2);
                      return (
                        <button key={b.band} type="button" title={b.descriptor}
                          onClick={() => setPoints((p) => p.map((v, j) => j === i ? mid : v))}
                          style={{ textAlign: "left", fontSize: 11.5, lineHeight: 1.35, padding: "6px 8px", borderRadius: 7, cursor: "pointer",
                            border: `1px solid ${active ? "var(--orange-500, #E8722A)" : "var(--line)"}`,
                            background: active ? "var(--orange-50, #FDF1E8)" : "transparent", color: "inherit" }}>
                          <b>Bande {b.band} · {b.scoreRange[0]}–{b.scoreRange[1]}</b> — {b.descriptor}
                        </button>
                      );
                    })}
                    <textarea value={evidence[i] ?? ""} onChange={(e) => setEvidence((ev) => ev.map((v, j) => j === i ? e.target.value : v))}
                      placeholder="Preuve (obligatoire) : citation exacte du dossier — ou, pour une bande basse, sections parcourues et ce qui n'y figure pas…"
                      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${evidence[i]?.trim() ? "var(--line-strong)" : "var(--danger, #b91c1c)"}`, borderRadius: 8, fontFamily: "inherit", fontSize: 12, minHeight: 46, resize: "vertical" }} />
                  </div>
                )}
              </div>
            ))}
            <div className="gradetotal">
              <span>Total · seuil {threshold}</span>
              <span style={{ color: decision === "CERTIFIED" ? "var(--success)" : "var(--danger)" }}><b className="num">{total}</b>/{maxTotal}</span>
            </div>
            {banded && (
              // Prévisualisation de la décision du socle §6 (conditions exclusives —
              // la règle des minimums prime sur le total).
              <div className="row between" style={{ marginTop: 8, gap: 8 }}>
                <span className={`pill ${decision === "CERTIFIED" ? "pill--green" : decision === "RESUBMIT" ? "pill--warn" : "pill--red"}`}>
                  {decision === "CERTIFIED" ? "Certifié" : decision === "RESUBMIT" ? "Remise demandée" : "Non certifié"}
                </span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {minimumsMissed.length === 0 ? "Tous les minimums atteints" : `Minimum(s) non atteint(s) : ${minimumsMissed.join(" · ")}`}
                </span>
              </div>
            )}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Retour écrit à l'apprenant (3 lignes minimum recommandées — socle §7)…"
              style={{ width: "100%", marginTop: 12, padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 9, fontFamily: "inherit", fontSize: 13, minHeight: 80, resize: "vertical" }} />
          </>)}
          {msg && <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--navy-600)" }}>{msg}</p>}
        </div>
        <div className="df">
          <button className="btn" onClick={onClose}>Fermer</button>
          <button className="btn btn--primary" disabled={busy === "grade" || crit.length === 0} onClick={grade}>{busy === "grade" ? "…" : "Enregistrer la note"}</button>
        </div>
      </aside>
    </>
  );
}

export function Evaluation() {
  const { data, loading, error, reload } = useAsync<EvalQueueItem[]>(() => api.evaluations(), []);
  const [sel, setSel] = useState<EvalQueueItem | null>(null);
  const [filter, setFilter] = useState("À traiter");

  const rows = useMemo(() => (data ?? []).filter((i) =>
    filter === "Tous" || (filter === "À traiter" && (i.revisionStatus === "SUBMITTED" || i.revisionStatus === "ASSIGNED")) || (filter === "Validés" && i.revisionStatus === "PASSED")
  ), [data, filter]);
  const pending = (data ?? []).filter((i) => i.revisionStatus === "SUBMITTED" || i.revisionStatus === "ASSIGNED").length;

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Certification · {pending} à traiter</div>
          <h1>Projets Bloc 4</h1>
          <div className="sub">File d'évaluation des projets de certification — notez à la grille.</div>
        </div>
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}><option>À traiter</option><option>Validés</option><option>Tous</option></select>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Apprenant</th><th>Parcours</th><th>Soumis</th><th>Évaluateur</th><th>Score</th><th>Statut</th></tr></thead>
            <tbody>
              {rows.map((i) => {
                const st = STATUS[i.revisionStatus] ?? { cls: "pill--soft", label: i.revisionStatus };
                return (
                  <tr key={i.enrollmentId} onClick={() => setSel(i)}>
                    <td><div className="uitem"><span className="av" style={{ background: avatarColor(i.learner.name) }}>{initials(i.learner.name)}</span><div className="who"><b>{i.learner.name}</b><span>{i.learner.email}</span></div></div></td>
                    <td><span className="muted" style={{ fontSize: 12.5 }}>{i.courseTitle}</span></td>
                    <td><span style={{ fontSize: 12.5 }}>{ago(i.submittedAt)}</span></td>
                    <td>{i.evaluator ? <span style={{ fontSize: 12.5 }}>{i.evaluator.name}</span> : <span className="muted">— non attribué</span>}</td>
                    <td>{i.scoreTotal != null ? <span className="pill pill--soft">{i.scoreTotal}%</span> : <span className="muted">—</span>}</td>
                    <td><span className={`pill ${st.cls}`}><span className="dot" />{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && <div className="empty">Chargement de la file…</div>}
          {error && <div className="empty" style={{ color: "var(--danger)" }}>Erreur : {error}</div>}
          {!loading && !error && rows.length === 0 && <div className="empty"><div className="big">🎓</div>Aucun projet à évaluer pour ce filtre.</div>}
        </div>
      </div>

      <AccreditationPanel />

      {sel && <GradeDrawer item={sel} onClose={() => setSel(null)} onDone={() => { reload(); }} />}
    </div>
  );
}

/** Registre d'habilitation (socle §9.2) : qui peut évaluer quel parcours,
 *  jusqu'à quand — octroi après calibration, révocation datée, historique. */
function AccreditationPanel() {
  const { data, reload } = useAsync<Accreditation[]>(() => api.accreditations(), []);
  const [courses, setCourses] = useState<{ id: string; slug?: string; title?: string }[]>([]);
  const [evaluators, setEvaluators] = useState<UserRow[]>([]);
  const [form, setForm] = useState({ evaluatorId: "", courseId: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.courses().then((cs: any[]) => setCourses(cs)).catch(() => {});
    api.users().then((us) => setEvaluators(us.filter((u) => EVALUATOR_ROLES.has(u.role) && !u.disabled))).catch(() => {});
  }, []);

  async function grant() {
    if (!form.evaluatorId || !form.courseId) return;
    setBusy(true); setMsg(null);
    try {
      await api.grantAccreditation(form.evaluatorId, form.courseId, form.notes.trim() || undefined);
      setForm({ evaluatorId: "", courseId: "", notes: "" });
      setMsg("Habilitation accordée pour 12 mois.");
      reload();
    } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    const okGo = await modal.confirm({ title: "Révoquer cette habilitation ?", body: "L'évaluateur ne pourra plus être assigné ni noter sur ce parcours. L'historique est conservé." });
    if (!okGo) return;
    try { await api.revokeAccreditation(id); reload(); } catch (e: any) { setMsg(e?.message || "Erreur"); }
  }

  const ST: Record<string, { cls: string; label: string }> = {
    active: { cls: "pill--green", label: "Active" },
    expired: { cls: "pill--warn", label: "Expirée" },
    revoked: { cls: "pill--red", label: "Révoquée" },
  };
  const activeCount = (data ?? []).filter((a) => a.status === "active").length;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h">
        <h3>Évaluateurs habilités <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(socle §9.2 — calibration, validité 12 mois par parcours ; minimum 2 par parcours pour la rotation et la double notation)</span></h3>
        <span className={`pill ${activeCount >= 2 ? "pill--green" : "pill--warn"}`}>{activeCount} active(s)</span>
      </div>
      <div className="card-b">
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select className="select" value={form.evaluatorId} onChange={(e) => setForm({ ...form, evaluatorId: e.target.value })}>
            <option value="">Évaluateur…</option>
            {evaluators.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
          <select className="select" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">Parcours…</option>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title ?? c.slug ?? c.id}</option>)}
          </select>
          <input className="select" style={{ minWidth: 260, flex: 1 }} placeholder="Notes de calibration (écarts sur les 3 dossiers de référence)…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button className="btn btn--primary btn--sm" disabled={busy || !form.evaluatorId || !form.courseId} onClick={grant}>{busy ? "…" : "Habiliter (12 mois)"}</button>
        </div>
        {msg && <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--navy-600)", margin: "0 0 10px" }}>{msg}</p>}
        {(data ?? []).length === 0 ? <div className="empty" style={{ padding: "22px 10px" }}>Aucune habilitation. Aucun évaluateur ne peut être assigné ni noter tant qu'il n'est pas habilité.</div> : (
          <table className="table">
            <thead><tr><th>Évaluateur</th><th>Parcours</th><th>Accordée</th><th>Expire</th><th>Par</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {(data ?? []).map((a) => (
                <tr key={a.id}>
                  <td><b style={{ fontSize: 13 }}>{a.evaluator.name}</b> <span className="muted" style={{ fontSize: 12 }}>{a.evaluator.email}</span></td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>{a.course.slug}</span></td>
                  <td style={{ fontSize: 12.5 }}>{new Date(a.grantedAt).toLocaleDateString("fr-FR")}</td>
                  <td style={{ fontSize: 12.5 }}>{new Date(a.expiresAt).toLocaleDateString("fr-FR")}</td>
                  <td style={{ fontSize: 12.5 }}>{a.grantedBy?.name ?? "—"}</td>
                  <td><span className={`pill ${(ST[a.status] ?? ST.active).cls}`}>{(ST[a.status] ?? ST.active).label}</span></td>
                  <td>{a.status === "active" && <button className="btn btn--sm btn--ghost" onClick={() => void revoke(a.id)}>Révoquer</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
