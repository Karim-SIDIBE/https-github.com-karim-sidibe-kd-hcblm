import { useEffect, useMemo, useState } from "react";
import { api, auth, type Accreditation, type AiCalibrationStatus, type AiComplianceIndicators, type AppealsRegister, type EvalQueueItem, type EvidenceAssist, type ProjectDetail, type QcRegister, type RubricCriterion, type RubricSuggestion, type UserRow } from "../lib/api";
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

/** Ordre du parcours — clé primaire : le numéro de SECTION (« Section 4 »
 *  avant « Section 5 », quel que soit le numéro de micro-session) ; repli sur
 *  le numéro de micro-session, puis fin de liste. Utilisé seulement quand le
 *  serveur ne fournit pas `sectionMeta` (déjà ordonné). */
function sectionOrder(title: string): number {
  const sec = title.match(/section\s*(\d+)/i);
  if (sec) return Number(sec[1]) * 100;
  const ms = title.match(/(\d+)[.,](\d+)/);
  return ms ? Number(ms[1]) * 100 + Number(ms[2]) : Number.MAX_SAFE_INTEGER;
}

const frDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : null);

/** Dates du journal S1 en pastilles : vert = jour de saisie distinct,
 *  orange = plusieurs entrées saisies le même jour (rattrapage cumulé),
 *  gris = entrée manquante. Le cumul se voit d'un coup d'œil. */
function JournalDates({ entries }: { entries: { day: number; completedAt: string | null }[] }) {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (!e.completedAt) continue;
    const d = new Date(e.completedAt).toLocaleDateString("fr-FR");
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      {entries.map((e) => {
        const d = e.completedAt ? new Date(e.completedAt).toLocaleDateString("fr-FR") : null;
        const cumul = d != null && (counts.get(d) ?? 0) > 1;
        return (
          <span key={e.day} className={`pill pill--sm ${d == null ? "pill--soft" : cumul ? "pill--warn" : "pill--green"}`}
            title={d == null ? "Entrée manquante" : cumul ? "Plusieurs entrées saisies ce jour-là (cumul)" : "Jour de saisie distinct"}>
            J+{e.day} · {d ?? "—"}
          </span>
        );
      })}
      <span className="muted" style={{ fontSize: 11, alignSelf: "center" }}>vert = saisie étalée · orange = cumul (même jour)</span>
    </div>
  );
}

function GradeDrawer({ item, onClose, onDone }: { item: EvalQueueItem; onClose: () => void; onDone: () => void }) {
  const me = auth.user();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [points, setPoints] = useState<number[]>(() => (item.rubric?.criteria ?? []).map(() => 0));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"" | "assign" | "grade" | "ai" | "draft" | "helper">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [evaluators, setEvaluators] = useState<UserRow[]>([]);
  const [pick, setPick] = useState("");
  const [ai, setAi] = useState<RubricSuggestion | null>(null);
  // Aide à la preuve pré-notation : citations vérifiées par critère, sans
  // aucune note (le serveur ne les envoie pas) — pas soumise au verrou §8.6.
  const [helper, setHelper] = useState<EvidenceAssist | null>(null);
  // §8.8 : le bouton de suggestion reste désactivé tant que la calibration du
  // couple (parcours, modèle, version de grille) n'est pas passée.
  const [calib, setCalib] = useState<AiCalibrationStatus | null>(null);
  // §8.6 : la suggestion ne s'affiche qu'après ENREGISTREMENT du score humain.
  const [draftSaved, setDraftSaved] = useState(Boolean(item.draftAt));

  useEffect(() => { api.project(item.enrollmentId).then(setDetail).catch(() => setDetail(null)); }, [item.enrollmentId]);
  useEffect(() => { api.aiCalibrationStatus(item.courseId).then(setCalib).catch(() => setCalib(null)); }, [item.courseId]);
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

  // Dossier déjà noté à l'ouverture → FICHE DE NOTATION en lecture (points,
  // bande, preuve par critère + note IA en regard) à la place de la grille de
  // saisie vierge. `renote` rouvre la grille pour la seconde notation d'une
  // remise (REVISION_REQUESTED) — seule re-notation légitime hors recours.
  const [renote, setRenote] = useState(false);
  const [gradedNow, setGradedNow] = useState(false);
  const sealed = item.scoreTotal != null && !gradedNow && !renote;
  const fiche = sealed ? (detail?.criteria ?? null) : null;
  const aiPointsOf = (label: string) => (ai?.criteria ?? []).find((s) => s.label === label)?.suggested ?? null;
  const DECISION_LABEL: Record<string, { label: string; cls: string }> = {
    CERTIFIED: { label: "Certifié", cls: "pill--green" }, RESUBMIT: { label: "Remise demandée", cls: "pill--warn" }, NOT_CERTIFIED: { label: "Non certifié", cls: "pill--red" },
  };

  const [f2f, setF2f] = useState(false);
  async function assign(evaluatorId: string) {
    setBusy("assign"); setMsg(null);
    // Déclaration FACE2FACE (socle §5.1) : cochée = incompatibilité déclarée,
    // le serveur refuse et le dossier doit partir à un autre évaluateur.
    try { await api.assignEvaluator(item.enrollmentId, evaluatorId, f2f); setMsg("Projet attribué (déclaration FACE2FACE : aucun lien)."); onDone(); } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(""); }
  }
  async function saveDraft() {
    setBusy("draft"); setMsg(null);
    try {
      await api.saveEvaluationDraft(item.enrollmentId, points.map((p, i) => ({ index: i, points: p, evidence: evidence[i]?.trim() || undefined })));
      setDraftSaved(true);
      setMsg("Scores enregistrés (brouillon §8.6) — la suggestion est maintenant consultable.");
    } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(""); }
  }
  async function evidenceHelp() {
    setBusy("helper"); setMsg(null);
    try { setHelper(await api.evidenceAssist(item.enrollmentId)); }
    catch (e: any) { setMsg(e?.message || "Aide à la preuve indisponible"); }
    finally { setBusy(""); }
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
    if (!ai?.criteria) return;
    // Align by label (the service returns the rubric's own labels, clamped).
    setPoints(crit.map((c) => ai.criteria!.find((s) => s.label === c.label)?.suggested ?? 0));
  }
  /** §8.6 : le champ de preuve démarre vide — toute copie depuis la suggestion
   *  est une ACTION EXPLICITE ; le serveur journalise l'identité des preuves.
   *  CUMULATIVE : un critère peut réunir plusieurs extraits — chaque insertion
   *  s'ajoute à la ligne, elle n'écrase pas la précédente. */
  function copyEvidence(i: number, text: string) {
    setEvidence((ev) => ev.map((v, j) => (j === i ? (v.trim() ? `${v.trimEnd()}\n${text}` : text) : v)));
  }
  async function grade() {
    if (banded && evidence.some((e) => !e.trim())) { setMsg("Preuve manquante : chaque critère exige une citation exacte ou une déclaration d'absence (règle 3 du socle)."); return; }
    setBusy("grade"); setMsg(null);
    try {
      await api.gradeProject(item.enrollmentId, { criteria: points.map((p, i) => ({ index: i, points: p, evidence: evidence[i]?.trim() || undefined })), notes: notes.trim() || undefined });
      const label = decision === "CERTIFIED" ? "certifié" : decision === "RESUBMIT" ? "remise demandée" : "non certifié";
      setGradedNow(true);
      onDone();
      // La note humaine est scellée → la suggestion IA se dévoile maintenant
      // d'elle-même, en regard (§8.6 satisfait par la notation finale).
      try { setAi(await api.rubricSuggestion(item.enrollmentId)); } catch { /* indisponible : la décision est enregistrée quand même */ }
      setMsg(`Décision enregistrée : ${total}/100 — ${label}. La suggestion IA s'affiche ci-dessus pour comparaison.`);
    } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(""); }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer drawer--wide">
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
              <JournalDates entries={item.journal.entries} />
              {item.journal.groupedCatchup && (
                <div style={{ color: "var(--red, #b91c1c)", fontSize: 12.5, marginTop: 4 }}>⚠️ rattrapage groupé (plus de 2 entrées le même jour)</div>
              )}
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
            // Copies affichées dans l'ORDRE DU PARCOURS (Section 1 → 5) — ordre
            // fourni par le serveur (sectionMeta), avec la date de dépôt en face
            // de chaque section et les micro-entrées datées dans la Section 4.
            : (detail?.sectionMeta?.length
              ? detail.sectionMeta.map((m) => ({ title: m.title, body: sections[m.title] ?? "", submittedAt: m.submittedAt, journal: m.journal }))
              : Object.entries(sections)
                .sort(([a], [b]) => sectionOrder(a) - sectionOrder(b) || a.localeCompare(b, "fr"))
                .map(([title, body]) => ({ title, body, submittedAt: null as string | null, journal: false }))
            ).map((s) => (
              <div className="section" key={s.title}>
                <div className="row between" style={{ gap: 8, alignItems: "baseline" }}>
                  <h4 style={{ margin: 0 }}>{s.title}</h4>
                  <span className={`pill pill--sm ${s.submittedAt ? "pill--soft" : "pill--warn"}`} style={{ flexShrink: 0 }}>
                    {s.submittedAt ? `déposée le ${frDate(s.submittedAt)}` : "non déposée"}
                  </span>
                </div>
                {s.journal && (detail?.journalEntries?.length ?? 0) > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    {detail!.journalEntries!.map((e) => (
                      <div key={e.day} style={{ borderLeft: "3px solid var(--line)", paddingLeft: 10 }}>
                        <div className="row" style={{ gap: 8, alignItems: "center" }}>
                          <b style={{ fontSize: 12.5 }}>J+{e.day}</b>
                          <span className={`pill pill--sm ${e.completedAt ? "pill--soft" : "pill--red"}`}>{e.completedAt ? frDate(e.completedAt) : "manquante"}</span>
                        </div>
                        {e.text ? <p style={{ margin: "4px 0 0" }}>{e.text}</p> : <p className="muted" style={{ margin: "4px 0 0", fontSize: 12.5 }}>— aucune entrée saisie</p>}
                      </div>
                    ))}
                  </div>
                ) : <p>{s.body}</p>}
              </div>
            ))}

          <div className="eyebrow" style={{ margin: "20px 0 6px" }}>Grille d'évaluation</div>
          {crit.length > 0 && !ai && (
            <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              {!sealed && <button className="btn btn--sm" disabled={busy === "draft"} onClick={saveDraft}>
                {busy === "draft" ? "…" : draftSaved ? "Ré-enregistrer mes scores" : "Enregistrer mes scores (brouillon)"}
              </button>}
              {!sealed && <button className="btn btn--sm btn--ghost" disabled={busy === "helper" || Boolean(helper) || !calib?.active || item.appealStage > 0}
                title={item.appealStage > 0 ? "Indisponible en recours : notation à l'aveugle (§8.7)"
                  : !calib?.active ? "Calibration IA non passée sur ce parcours (§8.8)"
                  : "Affiche sous chaque critère les extraits du dossier vérifiés mot pour mot — sans aucune note"}
                onClick={evidenceHelp}>
                {busy === "helper" ? "Recherche des preuves…" : helper ? "🔎 Preuves affichées sous chaque critère" : "🔎 Aide à la preuve (IA, sans note)"}
              </button>}
              <button className="btn btn--sm btn--ghost" disabled={busy === "ai" || !calib?.active || (!draftSaved && item.scoreTotal == null) || item.appealStage > 0}
                title={item.appealStage > 0 ? "Indisponible en recours : notation à l'aveugle (§8.7)"
                  : !calib?.active ? "Calibration IA non passée sur ce parcours (§8.8) — panneau « Suggestion automatisée » ci-dessous"
                  : !draftSaved && item.scoreTotal == null ? "Enregistrez d'abord vos scores : la suggestion ne s'affiche qu'après le score humain (§8.6)" : undefined}
                onClick={suggest}>
                {busy === "ai" ? "Analyse du dossier…" : sealed ? "✨ Afficher la note IA en regard (comparaison)" : "✨ Suggestion de note (IA, indicative)"}
              </button>
              {helper && <span className="muted" style={{ fontSize: 11.5 }}>Extraits vérifiés mot pour mot par la plateforme, sans note — la suggestion chiffrée reste soumise à l'enregistrement de vos scores (§8.6).</span>}
              {!calib?.active && <span className="muted" style={{ fontSize: 11.5 }}>Suggestion désactivée : calibration §8.8 non passée{calib ? ` (${calib.provider})` : ""}.</span>}
              {calib?.active && !sealed && !draftSaved && item.scoreTotal == null && <span className="muted" style={{ fontSize: 11.5 }}>Saisissez et enregistrez VOS scores avant de consulter la suggestion (§8.6).</span>}
            </div>
          )}
          {/* Les refus serveur (calibration §8.8, recours §8.7…) doivent se lire
              À CÔTÉ des boutons qui les provoquent — pas seulement tout en bas
              du volet (retour terrain : « le bouton ne fait rien »). */}
          {msg && busy === "" && <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 600, color: "var(--navy-600)" }}>{msg}</p>}
          {ai && (
            <div className="card" style={{ marginBottom: 10, background: "var(--bg)" }}>
              <div className="card-b" style={{ fontSize: 12.5 }}>
                <b>✨ Suggestion {ai.aiGenerated ? "IA" : "automatique"} : {ai.suggestedScore}/100</b> — {ai.feedback}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "8px 0" }}>
                  {(ai.criteria ?? []).map((s, i) => (
                    <div key={s.label} style={{ borderLeft: "3px solid var(--line)", paddingLeft: 8 }}>
                      <div>{s.label} : <b>{s.suggested}/{s.weightPoints}</b> — {s.comment}</div>
                      {(s.citations ?? []).map((c, k) => (
                        <div key={k} className="row" style={{ gap: 6, alignItems: "flex-start", marginTop: 3 }}>
                          <span className="muted" style={{ fontSize: 12, fontStyle: "italic", flex: 1 }}>« {c} » <span style={{ fontStyle: "normal" }}>✓ vérifiée dans le dossier</span></span>
                          {!gradedNow && item.scoreTotal == null && <button className="btn btn--sm btn--ghost" style={{ flexShrink: 0 }} title="Copie explicite — l'identité des preuves est journalisée (§8.6/§8.9)" onClick={() => copyEvidence(i, c)}>Reprendre</button>}
                        </div>
                      ))}
                      {s.absence && (
                        <div className="row" style={{ gap: 6, alignItems: "flex-start", marginTop: 3 }}>
                          <span className="muted" style={{ fontSize: 12, fontStyle: "italic", flex: 1 }}>Déclaration d'absence : {s.absence}</span>
                          {!gradedNow && item.scoreTotal == null && <button className="btn btn--sm btn--ghost" style={{ flexShrink: 0 }} title="Copie explicite — journalisée (§8.6/§8.9)" onClick={() => copyEvidence(i, s.absence!)}>Reprendre</button>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Dossier déjà noté (à l'instant ou avant l'ouverture) : la
                    suggestion est une COMPARAISON — plus rien à préremplir. */}
                {gradedNow || item.scoreTotal != null
                  ? <span className="muted">Notation humaine déjà enregistrée — suggestion affichée pour comparaison uniquement.</span>
                  : <>
                    <button className="btn btn--sm" onClick={applySuggestion}>Préremplir la grille avec ces notes</button>
                    <span className="muted" style={{ marginLeft: 8 }}>La décision reste humaine : ajustez avant d'enregistrer. Votre preuve doit démontrer VOTRE lecture du dossier.</span>
                  </>}
              </div>
            </div>
          )}
          {crit.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Grille indisponible.</p> : sealed ? (
            // FICHE DE NOTATION (lecture) : le dossier est déjà évalué — points,
            // bande et preuve par critère tels qu'archivés (socle §6), avec la
            // note IA en regard quand elle est affichée.
            <div>
              <div className="row between" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                <span className="row" style={{ gap: 8, alignItems: "center" }}>
                  {detail?.decision && DECISION_LABEL[detail.decision] && (
                    <span className={`pill ${DECISION_LABEL[detail.decision]!.cls}`}>{DECISION_LABEL[detail.decision]!.label}</span>
                  )}
                  <b style={{ fontSize: 15 }}>{item.scoreTotal}/{maxTotal}</b>
                  <span className="muted" style={{ fontSize: 12 }}>seuil {threshold}</span>
                </span>
                <span className="muted" style={{ fontSize: 12 }}>
                  Notée{detail?.evaluatedAt ? ` le ${frDate(detail.evaluatedAt)}` : ""}{item.evaluator ? ` par ${item.evaluator.name}` : ""}
                </span>
              </div>
              {!fiche?.length ? <p className="muted" style={{ fontSize: 13 }}>{detail ? "Détail par critère indisponible pour cette notation." : "Chargement de la fiche…"}</p>
                : crit.map((c, i) => {
                  const f = fiche.find((x) => x.label === c.label) ?? fiche[i];
                  if (!f) return null;
                  const aiPts = aiPointsOf(c.label);
                  return (
                    <div className="crit" key={c.label} style={{ display: "block" }}>
                      <div className="row between" style={{ gap: 8 }}>
                        <div className="lab">
                          {c.label}
                          <small>sur {c.weightPoints} pts{c.minPoints != null ? ` · minimum ${c.minPoints}` : ""}{c.origin ? ` · ${c.origin}` : ""}</small>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div><b className="num" style={{ fontSize: 15 }}>{f.points}</b>/{c.weightPoints}{f.band != null ? <span className="muted" style={{ fontSize: 12 }}> · Bande {f.band}</span> : null}</div>
                          {aiPts != null && (
                            <div className="muted" style={{ fontSize: 12 }}>
                              ✨ IA : {aiPts}/{c.weightPoints}
                              <span style={{ marginLeft: 6, color: aiPts === f.points ? "var(--success)" : undefined }}>
                                ({aiPts === f.points ? "identique" : `écart ${aiPts > f.points ? "+" : ""}${aiPts - f.points}`})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {f.evidence && <p className="muted" style={{ margin: "6px 0 0", fontSize: 12.5, fontStyle: "italic", borderLeft: "3px solid var(--line)", paddingLeft: 10 }}>Preuve : {f.evidence}</p>}
                    </div>
                  );
                })}
              {detail?.feedback && (
                <div style={{ marginTop: 12 }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>Retour écrit à l'apprenant</div>
                  <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>{detail.feedback}</p>
                </div>
              )}
              {!ai && calib?.active && item.appealStage === 0 && (
                <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Cliquez « ✨ Afficher la note IA en regard » ci-dessus pour comparer critère par critère.</p>
              )}
            </div>
          ) : (<>
            {banded && <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>Notation PAR BANDE (socle §5) : bandes de la plus faible (à gauche) à la plus forte (à droite) — choisissez la bande la plus haute dont <b>tous</b> les éléments sont satisfaits, milieu de bande par défaut. La preuve (citation exacte ou déclaration d'absence) est obligatoire pour chaque critère.</p>}
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
                  <div style={{ margin: "6px 0 4px" }}>
                    {/* Bandes À L'HORIZONTALE, faible → fort (gauche → droite) ; la
                        preuve obligatoire prend toute la largeur en dessous. */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 6 }}>
                      {[...c.bands!].sort((a, b) => a.band - b.band).map((b) => {
                        const active = points[i]! >= b.scoreRange[0] && points[i]! <= b.scoreRange[1];
                        const mid = Math.ceil((b.scoreRange[0] + b.scoreRange[1]) / 2);
                        return (
                          <button key={b.band} type="button" title={b.descriptor}
                            onClick={() => setPoints((p) => p.map((v, j) => j === i ? mid : v))}
                            style={{ textAlign: "left", fontSize: 11.5, lineHeight: 1.35, padding: "6px 8px", borderRadius: 7, cursor: "pointer", height: "100%",
                              border: `1px solid ${active ? "var(--orange-500, #E8722A)" : "var(--line)"}`,
                              background: active ? "var(--orange-50, #FDF1E8)" : "transparent", color: "inherit" }}>
                            <b>Bande {b.band} · {b.scoreRange[0]}–{b.scoreRange[1]}</b> — {b.descriptor}
                          </button>
                        );
                      })}
                    </div>
                    {helper && (() => {
                      // Aide à la preuve : extraits VÉRIFIÉS par la plateforme,
                      // sans note — l'insertion reste une action explicite et
                      // journalisée, le champ demeure la lecture de l'évaluateur.
                      const h = helper.criteria.find((x) => x.label === c.label);
                      if (!h) return null;
                      return (
                        <div style={{ marginTop: 6, fontSize: 12 }}>
                          {(h.citations ?? []).map((t, k) => (
                            <div key={k} className="row" style={{ gap: 6, alignItems: "flex-start", marginTop: 3 }}>
                              <span className="muted" style={{ fontStyle: "italic", flex: 1 }}>🔎 « {t} » <span style={{ fontStyle: "normal" }}>✓ vérifiée dans le dossier</span></span>
                              <button className="btn btn--sm btn--ghost" style={{ flexShrink: 0 }} title="Insertion explicite — l'identité des preuves est journalisée (§8.9)" onClick={() => copyEvidence(i, t)}>Insérer</button>
                            </div>
                          ))}
                          {h.absence && (
                            <div className="row" style={{ gap: 6, alignItems: "flex-start", marginTop: 3 }}>
                              <span className="muted" style={{ fontStyle: "italic", flex: 1 }}>🔎 Rien trouvé — {h.absence}</span>
                              <button className="btn btn--sm btn--ghost" style={{ flexShrink: 0 }} title="Insertion explicite — journalisée (§8.9)" onClick={() => copyEvidence(i, h.absence!)}>Insérer</button>
                            </div>
                          )}
                          {!h.verified && <div className="muted" style={{ marginTop: 3 }}>🔎 Aucune preuve fiable trouvée pour ce critère — à établir par votre lecture.</div>}
                        </div>
                      );
                    })()}
                    <textarea value={evidence[i] ?? ""} onChange={(e) => setEvidence((ev) => ev.map((v, j) => j === i ? e.target.value : v))}
                      placeholder="Preuve (obligatoire) : citation exacte du dossier — ou, pour une bande basse, sections parcourues et ce qui n'y figure pas…"
                      style={{ width: "100%", marginTop: 6, padding: "8px 10px", border: `1px solid ${evidence[i]?.trim() ? "var(--line-strong)" : "var(--danger, #b91c1c)"}`, borderRadius: 8, fontFamily: "inherit", fontSize: 12, minHeight: 46, resize: "vertical" }} />
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
          {/* Fiche scellée : pas de re-notation sauf remise (REVISION_REQUESTED,
              seconde notation prévue par le socle §6) — le recours suit son
              propre circuit à l'aveugle. */}
          {sealed
            ? (item.revisionStatus === "REVISION_REQUESTED" && (
              <button className="btn btn--primary" onClick={() => setRenote(true)}>Noter la remise (nouvelle grille)</button>
            ))
            : <button className="btn btn--primary" disabled={busy === "grade" || crit.length === 0 || gradedNow} onClick={grade}>{busy === "grade" ? "…" : "Enregistrer la note"}</button>}
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
      <AppealsPanel queue={data ?? []} />
      <QcPanel queue={data ?? []} />
      <AiGovernancePanel />

      {sel && <GradeDrawer item={sel} onClose={() => setSel(null)} onDone={() => { reload(); }} />}
    </div>
  );
}

/** Notation À L'AVEUGLE (recours §10 / double notation §9.3) : saisie points +
 *  preuve par critère — jamais les scores de la première notation à l'écran. */
function BlindGradeForm({ criteria, busy, onSubmit }: {
  criteria: RubricCriterion[]; busy: boolean;
  onSubmit: (scores: { index: number; points: number; evidence?: string }[]) => void;
}) {
  const [points, setPoints] = useState<number[]>(() => criteria.map(() => 0));
  const [evidence, setEvidence] = useState<string[]>(() => criteria.map(() => ""));
  const missing = evidence.some((e) => !e.trim());
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
      {criteria.map((c, i) => (
        <div key={c.label} className="row" style={{ gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, minWidth: 220, flex: 1 }}>{c.label} <span className="muted">/ {c.weightPoints}{c.minPoints != null ? ` · min ${c.minPoints}` : ""}</span></span>
          <input type="number" min={0} max={c.weightPoints} value={points[i]} style={{ width: 70 }}
            onChange={(e) => setPoints((p) => p.map((v, j) => j === i ? Math.max(0, Math.min(c.weightPoints, Number(e.target.value) || 0)) : v))} />
          <textarea value={evidence[i]} placeholder="Preuve (citation exacte ou déclaration d'absence)…"
            onChange={(e) => setEvidence((ev) => ev.map((v, j) => j === i ? e.target.value : v))}
            style={{ flex: 2, minWidth: 220, minHeight: 34, padding: "6px 8px", border: `1px solid ${evidence[i]?.trim() ? "var(--line-strong)" : "var(--danger, #b91c1c)"}`, borderRadius: 7, fontFamily: "inherit", fontSize: 12, resize: "vertical" }} />
        </div>
      ))}
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <button className="btn btn--primary btn--sm" disabled={busy || missing}
          onClick={() => onSubmit(points.map((p, i) => ({ index: i, points: p, evidence: evidence[i]!.trim() })))}>
          {busy ? "…" : `Enregistrer la notation aveugle (${points.reduce((a, b) => a + b, 0)}/100)`}
        </button>
        {missing && <span className="muted" style={{ fontSize: 11.5 }}>Preuve obligatoire pour chaque critère (règle 3 du socle).</span>}
      </div>
    </div>
  );
}

const APPEAL_ST: Record<string, { cls: string; label: string }> = {
  OPEN: { cls: "pill--warn", label: "Étape 2 — désigner le 2e évaluateur" },
  SECOND_ASSIGNED: { cls: "pill--info", label: "Étape 3 — notation aveugle en cours" },
  THIRD_REQUIRED: { cls: "pill--red", label: "Étape 4 — 3e évaluateur requis (écart ≥ 10)" },
  THIRD_ASSIGNED: { cls: "pill--info", label: "Étape 4 — décision du 3e attendue" },
  DECIDED: { cls: "pill--green", label: "Décidé (final)" },
};

/** Registre des recours (§10) : étapes, échéances, assignation et notation
 *  aveugle. Un taux > 5 % signale un défaut de grille, pas de candidats. */
function AppealsPanel({ queue }: { queue: EvalQueueItem[] }) {
  const me = auth.user();
  const { data, reload } = useAsync<AppealsRegister>(() => api.appeals(), []);
  const [evaluators, setEvaluators] = useState<UserRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api.users().then((us) => setEvaluators(us.filter((u) => EVALUATOR_ROLES.has(u.role) && !u.disabled))).catch(() => {}); }, []);

  async function assign(enrollmentId: string, evaluatorId: string) {
    if (!evaluatorId) return;
    setBusy(true); setMsg(null);
    try { await api.assignAppeal(enrollmentId, evaluatorId); reload(); }
    catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(false); }
  }
  async function grade(enrollmentId: string, scores: { index: number; points: number; evidence?: string }[]) {
    setBusy(true); setMsg(null);
    try {
      const r = await api.gradeAppeal(enrollmentId, scores);
      setMsg(r.needsThird ? `Écart de ${r.gap} points (≥ 10) : un troisième évaluateur doit trancher.` : `Décision finale appliquée : ${r.finalTotal}/100 (écart ${r.gap}).`);
      setOpen(null); reload();
    } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(false); }
  }

  const rows = data?.appeals ?? [];
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h">
        <h3>Recours <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(socle §10 — second évaluateur aveugle ; écart &lt; 10 : la moyenne fait foi ; ≥ 10 : un troisième tranche ; la décision issue du recours est finale)</span></h3>
        <span className={`pill ${data?.rateAlert ? "pill--red" : "pill--soft"}`}>{data?.ratePct ?? 0} % des dossiers{data?.rateAlert ? " — défaut de grille ?" : ""}</span>
      </div>
      <div className="card-b">
        {msg && <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--navy-600)", margin: "0 0 10px" }}>{msg}</p>}
        {rows.length === 0 ? <div className="empty" style={{ padding: "18px 10px" }}>Aucun recours déposé.</div> : (
          <table className="table">
            <thead><tr><th>Candidat</th><th>Déposé</th><th>Critères contestés</th><th>1re note</th><th>Écart</th><th>Décision finale</th><th>Étape</th><th /></tr></thead>
            <tbody>
              {rows.map((a) => {
                const st = APPEAL_ST[a.status] ?? { cls: "pill--soft", label: a.status };
                const rubric = queue.find((q) => q.enrollmentId === a.enrollmentId)?.rubric;
                const mine = (a.status === "SECOND_ASSIGNED" && a.secondEvaluatorId === me?.id) || (a.status === "THIRD_ASSIGNED" && a.thirdEvaluatorId === me?.id);
                return (
                  <>
                    <tr key={a.id}>
                      <td><b style={{ fontSize: 13 }}>{a.candidate.name}</b></td>
                      <td style={{ fontSize: 12.5 }}>{ago(a.openedAt)}</td>
                      <td style={{ fontSize: 12 }}>{(a.contestedCriteria ?? []).join(" · ")}</td>
                      <td style={{ fontSize: 12.5 }}>{a.firstTotal}/100</td>
                      <td style={{ fontSize: 12.5 }}>{a.gap ?? "—"}</td>
                      <td style={{ fontSize: 12.5 }}>{a.finalTotal != null ? `${a.finalTotal}/100 · ${a.finalDecision}` : "—"}</td>
                      <td><span className={`pill pill--sm ${st.cls}`}>{st.label}</span></td>
                      <td>
                        {(a.status === "OPEN" || a.status === "THIRD_REQUIRED") && (
                          <select className="select" defaultValue="" onChange={(e) => void assign(a.enrollmentId, e.target.value)} disabled={busy}>
                            <option value="">{a.status === "OPEN" ? "2e évaluateur…" : "3e évaluateur…"}</option>
                            {evaluators.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        )}
                        {mine && rubric && <button className="btn btn--sm" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "Fermer" : "Noter à l'aveugle"}</button>}
                      </td>
                    </tr>
                    {open === a.id && rubric && (
                      <tr key={`${a.id}-form`}><td colSpan={8}>
                        <p className="muted" style={{ fontSize: 12, margin: "4px 0" }}>Notation À L'AVEUGLE : les scores de la première notation ne vous sont pas montrés. Reportez VOS preuves. La suggestion automatisée est indisponible (§8.7).</p>
                        <BlindGradeForm criteria={rubric.criteria} busy={busy} onSubmit={(s) => void grade(a.enrollmentId, s)} />
                      </td></tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const QC_ST: Record<string, { cls: string; label: string }> = {
  REQUIRED: { cls: "pill--warn", label: "À assigner (sélection 1/10)" },
  ASSIGNED: { cls: "pill--info", label: "Notation aveugle en cours" },
  GRADED: { cls: "pill--green", label: "Notée" },
  INCIDENT: { cls: "pill--red", label: "Incident (> 15 pts)" },
  RESOLVED: { cls: "pill--soft", label: "Incident résolu" },
};

/** Contrôle qualité (§9.3) : 10 % des dossiers en double notation aveugle —
 *  la note officielle ne change pas ; médiane trimestrielle et incidents. */
function QcPanel({ queue }: { queue: EvalQueueItem[] }) {
  const me = auth.user();
  const { data, reload } = useAsync<QcRegister>(() => api.qcList(), []);
  const [evaluators, setEvaluators] = useState<UserRow[]>([]);
  const [addFor, setAddFor] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api.users().then((us) => setEvaluators(us.filter((u) => EVALUATOR_ROLES.has(u.role) && !u.disabled))).catch(() => {}); }, []);

  async function assign(enrollmentId: string, evaluatorId: string) {
    if (!enrollmentId || !evaluatorId) return;
    setBusy(true); setMsg(null);
    try { await api.qcAssign(enrollmentId, evaluatorId); setAddFor(""); reload(); }
    catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(false); }
  }
  async function grade(id: string, scores: { index: number; points: number; evidence?: string }[]) {
    setBusy(true); setMsg(null);
    try {
      const r = await api.qcGrade(id, scores);
      setMsg(r.status === "INCIDENT" ? `Écart de ${r.gap} points (> 15) : incident consigné — un troisième évaluateur tranche.` : `Double notation consignée (écart ${r.gap} pts). La note officielle ne change pas.`);
      setOpen(null); reload();
    } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(false); }
  }
  async function resolve(id: string) {
    const evaluatorId = await modal.prompt({ title: "Troisième évaluateur (identifiant utilisateur)", body: "Il tranche l'incident ; tout est consigné au journal de calibration." });
    if (!evaluatorId) return;
    const totalStr = await modal.prompt({ title: "Total tranché (/100)" });
    if (!totalStr) return;
    const notes = await modal.prompt({ title: "Notes de résolution" });
    if (!notes) return;
    setBusy(true); setMsg(null);
    try { await api.qcResolve(id, { thirdEvaluatorId: evaluatorId, thirdTotal: Number(totalStr) || 0, notes }); reload(); }
    catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(false); }
  }

  const gradedQueue = queue.filter((q) => q.scoreTotal != null);
  const s = data?.summary;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h">
        <h3>Contrôle qualité <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(socle §9.3 — 10 % des dossiers notés en double à l'aveugle ; médiane trimestrielle &gt; 8 : réviser ou recalibrer ; écart &gt; 15 : un troisième tranche)</span></h3>
        <span className={`pill ${s?.medianAlert ? "pill--red" : "pill--soft"}`}>médiane {s?.medianGap ?? "—"} pts · {s?.incidents ?? 0} incident(s)</span>
      </div>
      <div className="card-b">
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <select className="select" value={addFor} onChange={(e) => setAddFor(e.target.value)}>
            <option value="">Ajouter un dossier noté au contrôle…</option>
            {gradedQueue.map((q) => <option key={q.enrollmentId} value={q.enrollmentId}>{q.learner.name} — {q.scoreTotal}/100</option>)}
          </select>
          <select className="select" defaultValue="" disabled={!addFor || busy} onChange={(e) => void assign(addFor, e.target.value)}>
            <option value="">Second évaluateur…</option>
            {evaluators.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        {msg && <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--navy-600)", margin: "0 0 10px" }}>{msg}</p>}
        {(data?.rows ?? []).length === 0 ? <div className="empty" style={{ padding: "18px 10px" }}>Aucune double notation pour l'instant — la sélection automatique marque un dossier noté sur dix.</div> : (
          <table className="table">
            <thead><tr><th>Candidat</th><th>Sélection</th><th>1re note</th><th>2e note</th><th>Écart</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {(data?.rows ?? []).map((r) => {
                const st = QC_ST[r.status] ?? { cls: "pill--soft", label: r.status };
                const rubric = queue.find((q) => q.enrollmentId === r.enrollmentId)?.rubric;
                const mine = r.status === "ASSIGNED" && r.secondEvaluatorId === me?.id;
                return (
                  <>
                    <tr key={r.id}>
                      <td><b style={{ fontSize: 13 }}>{r.candidate.name}</b></td>
                      <td style={{ fontSize: 12.5 }}>{r.sequence > 0 ? `auto (n° ${r.sequence})` : "manuelle"}</td>
                      <td style={{ fontSize: 12.5 }}>{r.firstTotal}/100</td>
                      <td style={{ fontSize: 12.5 }}>{r.secondTotal != null ? `${r.secondTotal}/100` : "—"}</td>
                      <td style={{ fontSize: 12.5 }}>{r.gap ?? "—"}{r.thirdTotal != null ? ` → tranché ${r.thirdTotal}/100` : ""}</td>
                      <td><span className={`pill pill--sm ${st.cls}`}>{st.label}</span></td>
                      <td className="row" style={{ gap: 6 }}>
                        {r.status === "REQUIRED" && (
                          <select className="select" defaultValue="" disabled={busy} onChange={(e) => void assign(r.enrollmentId, e.target.value)}>
                            <option value="">Assigner…</option>
                            {evaluators.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        )}
                        {mine && rubric && <button className="btn btn--sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Fermer" : "Noter à l'aveugle"}</button>}
                        {r.status === "INCIDENT" && <button className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void resolve(r.id)}>Faire trancher</button>}
                      </td>
                    </tr>
                    {open === r.id && rubric && (
                      <tr key={`${r.id}-form`}><td colSpan={7}>
                        <p className="muted" style={{ fontSize: 12, margin: "4px 0" }}>Notation À L'AVEUGLE de surveillance : la première note ne vous est pas montrée et la note officielle ne changera pas — l'écart alimente la médiane trimestrielle.</p>
                        <BlindGradeForm criteria={rubric.criteria} busy={busy} onSubmit={(sc) => void grade(r.id, sc)} />
                      </td></tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Gouvernance de la suggestion automatisée (socle §8.8 et §8.10) :
 *  calibration sur les 5 dossiers de référence + indicateurs de surveillance. */
function AiGovernancePanel() {
  const [courses, setCourses] = useState<{ id: string; slug?: string; title?: string }[]>([]);
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState<AiCalibrationStatus | null>(null);
  const [indicators, setIndicators] = useState<AiComplianceIndicators | null>(null);
  const [runs, setRuns] = useState(() => ["A", "B", "C", "D", "E"].map((l) => ({ label: `Dossier ${l}`, text: "", reference: "" })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { api.courses().then((cs: any[]) => { setCourses(cs); if (cs[0] && !courseId) setCourseId(cs[0].id); }).catch(() => {}); }, []);
  useEffect(() => {
    if (!courseId) return;
    api.aiCalibrationStatus(courseId).then(setStatus).catch(() => setStatus(null));
    api.aiCompliance(courseId).then(setIndicators).catch(() => setIndicators(null));
  }, [courseId]);

  async function runCalibration() {
    const parsed = runs.map((r) => ({
      label: r.label, text: r.text.trim(),
      reference: r.reference.split(/[,;\s]+/).filter(Boolean).map(Number),
    }));
    if (parsed.some((r) => !r.text || r.reference.some((n) => !Number.isInteger(n)))) {
      setMsg("Chaque dossier exige son texte et ses scores de référence (entiers, un par critère, séparés par des virgules)."); return;
    }
    setBusy(true); setMsg(null);
    try {
      const rec = await api.runAiCalibration(courseId, parsed);
      setMsg(rec?.passed ? "Calibration PASSÉE — la suggestion est activée sur ce parcours." : "Calibration REFUSÉE — le bouton de suggestion reste désactivé (§8.8).");
      api.aiCalibrationStatus(courseId).then(setStatus).catch(() => {});
    } catch (e: any) { setMsg(e?.message || "Erreur"); } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h">
        <h3>Suggestion automatisée <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(socle §8 — calibration sur 5 dossiers de référence, écart ≤ 8 pts et ≤ 1 bande ; à refaire à chaque changement de modèle ou de grille)</span></h3>
        <span className={`pill ${status?.active ? "pill--green" : "pill--warn"}`}>{status?.active ? "Activée" : "Désactivée"}{status ? ` · ${status.provider}` : ""}</span>
      </div>
      <div className="card-b">
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title ?? c.slug ?? c.id}</option>)}
          </select>
          {status?.gridVersion && <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>Grille {status.gridVersion}</span>}
        </div>

        {status?.latest && (
          <table className="table" style={{ marginBottom: 12 }}>
            <thead><tr><th>Dossier</th><th>Référence</th><th>Proposé</th><th>Écart (≤ 8)</th><th>Bandes (≤ 1)</th><th>Preuve §8.4</th><th>Verdict</th></tr></thead>
            <tbody>
              {status.latest.results.map((r) => (
                <tr key={r.label}>
                  <td style={{ fontSize: 12.5 }}>{r.label}</td>
                  <td style={{ fontSize: 12.5 }}>{r.referenceTotal}/100</td>
                  <td style={{ fontSize: 12.5 }}>{r.proposedTotal}/100</td>
                  <td style={{ fontSize: 12.5 }}>{r.totalGap}</td>
                  <td style={{ fontSize: 12.5 }}>{r.maxBandDeviation}</td>
                  <td><span className={`pill pill--sm ${r.evidenceOk ? "pill--green" : "pill--red"}`}>{r.evidenceOk ? "vérifiée" : "échec"}</span></td>
                  <td><span className={`pill pill--sm ${r.ok ? "pill--green" : "pill--red"}`}>{r.ok ? "OK" : "hors seuil"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Le POURQUOI d'un échec de preuve (§8.4) — citation en cause et raison,
            pour ne plus diagnostiquer une pastille rouge à l'aveugle. */}
        {status?.latest?.results.some((r) => r.evidenceDetail?.length) && (
          <div style={{ marginBottom: 12 }}>
            <div className="eyebrow" style={{ margin: "0 0 4px" }}>Détail des preuves en échec (§8.4)</div>
            {status.latest.results.filter((r) => r.evidenceDetail?.length).map((r) => (
              <div key={r.label} style={{ fontSize: 12, marginBottom: 4 }}>
                <strong>{r.label}</strong>
                {r.evidenceDetail!.map((d, i) => <div key={i} className="muted" style={{ marginLeft: 10 }}>{d}</div>)}
              </div>
            ))}
          </div>
        )}

        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Lancer une calibration (5 dossiers de référence — les scores de référence ne sont jamais transmis au modèle)</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {runs.map((r, i) => (
              <div key={i} className="row" style={{ gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                <input className="select" style={{ width: 110 }} value={r.label} onChange={(e) => setRuns((rs) => rs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <textarea placeholder="Texte intégral du dossier de référence…" value={r.text}
                  onChange={(e) => setRuns((rs) => rs.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                  style={{ flex: 1, minWidth: 240, minHeight: 40, padding: "8px 10px", border: "1px solid var(--line-strong)", borderRadius: 8, fontFamily: "inherit", fontSize: 12, resize: "vertical" }} />
                <input className="select" style={{ width: 190 }} placeholder="Réf. par critère : 15,14,10,12,12,8" value={r.reference}
                  onChange={(e) => setRuns((rs) => rs.map((x, j) => j === i ? { ...x, reference: e.target.value } : x))} />
              </div>
            ))}
            <div><button className="btn btn--primary btn--sm" disabled={busy || !courseId} onClick={runCalibration}>{busy ? "Passage en cours…" : "Passer la calibration"}</button></div>
            {msg && <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--navy-600)", margin: 0 }}>{msg}</p>}
          </div>
        </details>

        <div className="eyebrow" style={{ margin: "4px 0 6px" }}>Indicateurs de surveillance (§8.10)</div>
        {!indicators || indicators.totals.suggestions === 0 ? (
          <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Aucune suggestion émise sur ce parcours pour l'instant.</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
              {indicators.totals.suggestions} suggestion(s) · {indicators.totals.blocked} bloquée(s) (§8.5) · {indicators.totals.linkedToFinal} liée(s) à une notation finale
            </p>
            <table className="table">
              <thead><tr><th>Critère</th><th>Taux de blocage (alerte &gt; 20 %)</th><th>Concordance IA/humain (alerte &gt; 90 %)</th><th>Identité des preuves (alerte = 100 %)</th></tr></thead>
              <tbody>
                {indicators.criteria.map((c) => (
                  <tr key={c.label}>
                    <td style={{ fontSize: 12.5 }}>{c.label} <span className="muted">({c.requests})</span></td>
                    <td><span className={`pill pill--sm ${c.blockAlert ? "pill--red" : "pill--soft"}`}>{c.blockRatePct ?? "—"}{c.blockRatePct != null ? " %" : ""}</span>{c.blockAlert && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>réviser le descripteur, pas le modèle</span>}</td>
                    <td><span className={`pill pill--sm ${c.concordanceAlert ? "pill--red" : "pill--soft"}`}>{c.concordancePct ?? "—"}{c.concordancePct != null ? " %" : ""}</span>{c.concordanceAlert && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>l'évaluateur valide sans évaluer</span>}</td>
                    <td><span className={`pill pill--sm ${c.identityAlert ? "pill--red" : "pill--soft"}`}>{c.evidenceIdentityPct ?? "—"}{c.evidenceIdentityPct != null ? " %" : ""}</span>{c.identityAlert && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>copie systématique</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
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
