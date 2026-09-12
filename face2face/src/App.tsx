import { useCallback, useEffect, useState } from "react";
import {
  api, auth, login as apiLogin, verify2fa, isStaffRole, canCreateModule, canGrade,
  rubricFromCourseContent, fmtDate,
  type Principal, type MyModule, type Overview, type CertState, type ModuleRow, type ModuleDetail,
  type ModuleSession, type ParticipantRow, type Rubric, type CourseSummary, type UserRow,
} from "./api";

/* ------------------------------------------------------------------ Marque - */
/** Lockup texte « KOMPETENCES FACE2FACE » (version chartée validée, sans logo). */
function Lockup({ dark = false, tagline = false, size = 13 }: { dark?: boolean; tagline?: boolean; size?: number }) {
  return (
    <div>
      <div className={`lockup${dark ? " lockup--dark" : ""}`} style={{ fontSize: size }}>
        <span className="k">KOMPETENCES</span> <span className="f2f">FACE2FACE</span>
      </div>
      {tagline && <div className="tagline" style={dark ? { color: "var(--grey)" } : undefined}>L'apprentissage par l'échange et l'immersion totale</div>}
    </div>
  );
}

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/* ------------------------------------------------------------------- Login - */
function Login({ onLogin }: { onLogin: (u: Principal) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await apiLogin(email, password);
      if ("twoFactorRequired" in r) { setChallenge(r.challenge); return; }
      auth.set(r.accessToken, r.user); onLogin(r.user);
    } catch (err) { setError(errMsg(err, "Identifiants invalides")); }
    finally { setBusy(false); }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true); setError(null);
    try { const r = await verify2fa(challenge, code.trim()); auth.set(r.accessToken, r.user); onLogin(r.user); }
    catch (err) { setError(errMsg(err, "Code invalide")); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={challenge ? submitCode : submit}>
        <div style={{ marginBottom: 16 }}><Lockup dark tagline size={16} /></div>
        {challenge ? (
          <>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Double authentification</div>
            <label className="lbl">Code<input className="field" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" autoFocus required /></label>
            {error && <p className="ko">{error}</p>}
            <button className="btn btn--block" disabled={busy || code.trim().length < 6} style={{ marginTop: 6 }}>{busy ? "…" : "Valider"}</button>
            <button type="button" className="btn ghost btn--block" style={{ marginTop: 8 }} onClick={() => { setChallenge(null); setCode(""); setError(null); }}>← Retour</button>
          </>
        ) : (
          <>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Espace présentiel</div>
            <label className="lbl">E-mail<input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
            <label className="lbl">Mot de passe<input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
            {error && <p className="ko">{error}</p>}
            <button className="btn btn--block" disabled={busy} style={{ marginTop: 6 }}>{busy ? "…" : "Se connecter"}</button>
          </>
        )}
      </form>
    </div>
  );
}

/* =================================================== ESPACE PARTICIPANT ==== */

/** Fiche d'ancrage : formulaire tant que la Session 1 n'est pas tenue, puis
 *  lecture seule définitivement (règle produit — verrou serveur 423). */
function AnchorCard({ ov, onSaved }: { ov: Overview; onSaved: () => void }) {
  const frozen = ov.anchor?.frozen ?? Boolean(ov.module.sessions.find((s) => s.index === 1)?.heldAt);
  const [situation, setSituation] = useState(ov.anchor?.situation ?? "");
  const [behaviorChange, setBehaviorChange] = useState(ov.anchor?.behaviorChange ?? "");
  const [beneficiary, setBeneficiary] = useState(ov.anchor?.beneficiary ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    try { await api.saveAnchor(ov.id, { situation, behaviorChange, beneficiary }); setSaved(true); onSaved(); }
    catch (err) { setError(errMsg(err, "Enregistrement impossible")); }
    finally { setBusy(false); }
  }

  const Q = ({ n, q, value, set }: { n: number; q: string; value: string; set: (v: string) => void }) => (
    <div style={{ marginBottom: 10 }}>
      <h2 style={{ fontSize: 13 }}>{n}. {q}</h2>
      {frozen
        ? <p style={{ margin: "4px 0 0", fontSize: 12.5 }}>{value || <span className="muted">—</span>}</p>
        : <textarea className="field" value={value} onChange={(e) => set(e.target.value)} required />}
    </div>
  );

  return (
    <form className="card" onSubmit={save}>
      <span className="eyebrow">Moment d'ancrage · Pilier 1</span>
      <h2>Ma fiche d'ancrage</h2>
      {ov.anchor === null && frozen
        ? <p className="muted" style={{ fontSize: 12.5 }}>Aucune fiche déposée avant la fin de la Session 1.</p>
        : <>
            <Q n={1} q="La situation professionnelle que je traverse et qui justifie cette compétence" value={situation} set={setSituation} />
            <Q n={2} q="Le comportement concret que je veux changer ou développer" value={behaviorChange} set={setBehaviorChange} />
            <Q n={3} q="La personne ou l'équipe qui bénéficiera directement de cette évolution" value={beneficiary} set={setBeneficiary} />
          </>}
      <div className="lock" style={{ margin: "4px 0 10px" }}>
        🔒 Visible par vous et votre formateur uniquement. <b>Définitivement figée à la fin de la Session 1</b> — elle sera revisitée en session finale pour mesurer le chemin parcouru.
      </div>
      {error && <p className="ko">{error}</p>}
      {saved && <p className="okmsg">Fiche enregistrée.</p>}
      {!frozen && <button className="btn btn--block" disabled={busy}>{busy ? "…" : "Enregistrer ma fiche d'ancrage"}</button>}
      {frozen && ov.anchor && <p className="meta">Figée depuis la fin de la Session 1 · dernière révision le {fmtDate(ov.anchor.updatedAt)}.</p>}
    </form>
  );
}

/** Journal de Bord : entrées figées à la soumission, 5 champs structurés. */
function JournalCard({ ov, onSaved }: { ov: Overview; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [periodIndex, setPeriodIndex] = useState(1);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [situation, setSituation] = useState("");
  const [action, setAction] = useState("");
  const [observation, setObservation] = useState("");
  const [learning, setLearning] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.addJournal(ov.id, { periodIndex, entryDate, situation, action, observation, learning });
      setSituation(""); setAction(""); setObservation(""); setLearning(""); setOpen(false);
      onSaved();
    } catch (err) { setError(errMsg(err, "Enregistrement impossible")); }
    finally { setBusy(false); }
  }

  const j = ov.journal;
  const done = j.count >= j.target;
  return (
    <div className="card">
      <div className="row between">
        <div><span className="eyebrow">Pilier 4 · pratique terrain</span><h2>Journal de bord</h2></div>
        <span className={`pill ${done ? "ok" : "warn"}`}>{j.count}/{j.target} entrées</span>
      </div>
      {j.entries.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>Aucune entrée pour l'instant — la qualité d'observation compte plus que la quantité.</p>}
      {j.entries.map((e) => (
        <div className="step" key={e.id}>
          <div className="dot done">✓</div>
          <div>
            <b className="t">{fmtDate(e.entryDate)} · Période {e.periodIndex}</b>
            <div className="meta">{e.situation}</div>
            <div className="meta"><b>Fait :</b> {e.action} · <b>Observé :</b> {e.observation} · <b>Appris :</b> {e.learning}</div>
          </div>
        </div>
      ))}
      {open ? (
        <form onSubmit={save} style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="row">
            <label className="lbl" style={{ flex: 1, marginBottom: 0 }}>Période
              <select className="field" value={periodIndex} onChange={(e) => setPeriodIndex(Number(e.target.value))}>
                {Array.from({ length: ov.module.shape.periods }, (_, i) => <option key={i + 1} value={i + 1}>Pratique terrain {i + 1}</option>)}
              </select>
            </label>
            <label className="lbl" style={{ flex: 1, marginBottom: 0 }}>Date
              <input className="field" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
            </label>
          </div>
          <label className="lbl" style={{ marginBottom: 0 }}>Situation rencontrée<textarea className="field" value={situation} onChange={(e) => setSituation(e.target.value)} required /></label>
          <label className="lbl" style={{ marginBottom: 0 }}>Ce que j'ai fait délibérément<textarea className="field" value={action} onChange={(e) => setAction(e.target.value)} required /></label>
          <label className="lbl" style={{ marginBottom: 0 }}>Ce que j'ai observé<textarea className="field" value={observation} onChange={(e) => setObservation(e.target.value)} required /></label>
          <label className="lbl" style={{ marginBottom: 0 }}>Ce que j'en apprends<textarea className="field" value={learning} onChange={(e) => setLearning(e.target.value)} required /></label>
          {error && <p className="ko">{error}</p>}
          <div className="row">
            <button className="btn" disabled={busy}>{busy ? "…" : "Enregistrer l'entrée →"}</button>
            <button type="button" className="btn ghost" onClick={() => { setOpen(false); setError(null); }}>Annuler</button>
          </div>
          <p className="meta">Une entrée est figée à la soumission. Décrivez des faits observables — l'entrée est refusée sous 25 mots.</p>
        </form>
      ) : (
        <button className="btn btn--block" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>Nouvelle entrée</button>
      )}
    </div>
  );
}

/** Missions Terrain : une par session, sauf la certifiante. */
function MissionsCard({ ov, onSaved }: { ov: Overview; onSaved: () => void }) {
  const [openFor, setOpenFor] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [peerName, setPeerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (openFor == null) return;
    setBusy(true); setError(null);
    try { await api.addMission(ov.id, { sessionIndex: openFor, text, peerName: peerName || undefined }); setText(""); setPeerName(""); setOpenFor(null); onSaved(); }
    catch (err) { setError(errMsg(err, "Enregistrement impossible")); }
    finally { setBusy(false); }
  }

  const slots = Array.from({ length: ov.module.shape.sessions - 1 }, (_, i) => i + 1);
  return (
    <div className="card">
      <span className="eyebrow">Pilier 5 · engagement public</span>
      <h2>Mes missions terrain</h2>
      {slots.map((idx) => {
        const m = ov.missions.find((x) => x.sessionIndex === idx);
        const session = ov.module.sessions.find((s) => s.index === idx);
        return (
          <div className="step" key={idx}>
            <div className={`dot ${m ? "done" : session?.heldAt ? "cur" : "next"}`}>{m ? "✓" : idx}</div>
            <div style={{ flex: 1 }}>
              <b className="t">Mission de la Session {idx}</b>
              {m ? (
                <>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5 }}>« {m.text} »</p>
                  <div className="meta">Engagée le {fmtDate(m.engagedAt)}{m.peerName ? ` · partagée avec votre pair ${m.peerName}` : ""}</div>
                </>
              ) : openFor === idx ? (
                <form onSubmit={save} style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 7 }}>
                  <textarea className="field" placeholder="La mission que je m'engage à réaliser avant la prochaine session…" value={text} onChange={(e) => setText(e.target.value)} required />
                  <input className="field" placeholder="Pair de suivi (optionnel)" value={peerName} onChange={(e) => setPeerName(e.target.value)} />
                  {error && <p className="ko">{error}</p>}
                  <div className="row">
                    <button className="btn btn--sm" disabled={busy}>{busy ? "…" : "Consigner la mission"}</button>
                    <button type="button" className="btn ghost btn--sm" onClick={() => { setOpenFor(null); setError(null); }}>Annuler</button>
                  </div>
                </form>
              ) : (
                <div style={{ marginTop: 4 }}>
                  <button className="btn ghost btn--sm" onClick={() => setOpenFor(idx)}>Consigner ma mission</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Conditions §6 + certification + certificat téléchargeable. */
function CertificationCard({ ov, cs }: { ov: Overview; cs: CertState | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true); setError(null);
    try {
      const blob = await api.certificatePdf(ov.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `certificat-face2face-niveau-${ov.module.level}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(errMsg(err, "Téléchargement impossible")); }
    finally { setBusy(false); }
  }

  const cert = ov.certification;
  return (
    <div className="card">
      <span className="eyebrow">Certification par démonstration</span>
      <h2>Mon dossier de certification</h2>
      {cert && (
        <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
          <div className="medal"><span>NIVEAU</span><b>{ov.module.level}</b><span>{ov.module.shape.label.toUpperCase()}</span></div>
          <h2 style={{ marginBottom: 2 }}>{cert.decision === "CERTIFIED" ? `Certification Niveau ${ov.module.level} · ${ov.module.shape.label}` : cert.decision === "RESUBMIT" ? "Seconde présentation proposée" : "Non certifié à cette session"}</h2>
          <p className="meta">Décision du {fmtDate(cert.evaluatedAt)} · score {cert.scoreTotal}/100</p>
          {cert.feedback && <p style={{ fontSize: 12.5, margin: "6px 0 0" }}>« {cert.feedback} »</p>}
          {ov.credential && (
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={download}>{busy ? "…" : "Télécharger le PDF"}</button>
              <a className="btn ghost" style={{ flex: 1 }} href={api.verifyUrl(ov.credential.id)} target="_blank" rel="noreferrer">Vérifier l'Open Badge</a>
            </div>
          )}
          {error && <p className="ko">{error}</p>}
        </div>
      )}
      {cs && (
        <div style={{ marginTop: cert ? 10 : 4 }}>
          {!cert && <p className="meta" style={{ marginTop: 0 }}>La décision certifiante exige <b>l'ensemble des conditions</b> (K-SPEM §6) — pas seulement la grille de l'évaluateur.</p>}
          {cs.prereqs.map((p) => (
            <div className="prereq" key={p.code}>
              <span className={p.ok ? "ok-i" : "ko-i"}>{p.ok ? "✓" : "✗"}</span> {p.label}
            </div>
          ))}
          {!cert && (cs.ok
            ? <p className="okmsg">Dossier complet — la mise en situation certifiante peut être évaluée.</p>
            : <p className="meta" style={{ marginTop: 8 }}>🔒 Grille verrouillée tant que le dossier est incomplet.</p>)}
        </div>
      )}
    </div>
  );
}

function ParticipantModule({ pid }: { pid: string }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [cs, setCs] = useState<CertState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.overview(pid).then(setOv).catch((e) => setError(errMsg(e, "Chargement impossible")));
    api.certState(pid).then(setCs).catch(() => setCs(null));
  }, [pid]);
  useEffect(() => { setOv(null); reload(); }, [reload]);

  if (error) return <p className="ko" style={{ padding: 20 }}>{error}</p>;
  if (!ov) return <div className="spin">Chargement…</div>;

  const m = ov.module;
  return (
    <div className="content">
      <div className="card" style={{ background: "linear-gradient(160deg,var(--navy),var(--navy2))", border: "none", color: "#fff" }}>
        <h1 style={{ color: "#fff", fontSize: 17 }}>{m.title}</h1>
        <div style={{ fontSize: 11.5, opacity: .8 }}>Niveau {m.level} · {m.shape.label} — {m.shape.sessions} sessions · cycle APP{m.location ? ` · ${m.location}` : ""}</div>
      </div>

      <div className="card">
        <div className="row between"><h2 style={{ margin: 0 }}>Mon parcours</h2><span className="pill mint">Journal : {ov.journal.count}/{ov.journal.target}</span></div>
        {m.sessions.map((s) => (
          <div className={`step${s.heldAt ? "" : " off"}`} key={s.index}>
            <div className={`dot ${s.heldAt ? (s.present ? "done" : "cur") : "next"}`}>{s.heldAt && s.present ? "✓" : s.index}</div>
            <div>
              <b className="t">{s.title}</b>{" "}
              {s.heldAt
                ? <span className={`pill ${s.present ? "ok" : "red"}`}>{s.present ? `présent · ${fmtDate(s.heldAt)}` : `absent · ${fmtDate(s.heldAt)}`}</span>
                : <span className="pill soft">{s.scheduledAt ? `prévue le ${fmtDate(s.scheduledAt)}` : "à planifier"}</span>}
              {s.index === m.shape.sessions && <div className="meta">Mise en situation certifiante (35-40 min) devant évaluateur</div>}
            </div>
          </div>
        ))}
      </div>

      <AnchorCard ov={ov} onSaved={reload} />
      <JournalCard ov={ov} onSaved={reload} />
      <MissionsCard ov={ov} onSaved={reload} />
      <CertificationCard ov={ov} cs={cs} />
    </div>
  );
}

function ParticipantSpace({ user, onLogout }: { user: Principal; onLogout: () => void }) {
  const [mods, setMods] = useState<MyModule[] | null>(null);
  const [pid, setPid] = useState<string | null>(null);
  useEffect(() => {
    api.myModules().then((m) => { setMods(m); if (m.length) setPid(m[0].participantId); }).catch(() => setMods([]));
  }, []);

  return (
    <div className="shell">
      <div className="topbar">
        <Lockup tagline />
        <div className="row">
          {mods && mods.length > 1 && (
            <select className="field" style={{ width: "auto", padding: "6px 10px", fontSize: 12 }} value={pid ?? ""} onChange={(e) => setPid(e.target.value)}>
              {mods.map((m) => <option key={m.participantId} value={m.participantId}>{m.module.title}</option>)}
            </select>
          )}
          <span style={{ fontSize: 12, opacity: .85 }}>{user.name}</span>
          <button className="btn ghost btn--sm" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.5)", boxShadow: "none" }} onClick={onLogout}>Déconnexion</button>
        </div>
      </div>
      {mods === null ? <div className="spin">Chargement…</div>
        : mods.length === 0 ? <div className="content"><div className="card"><h2>Aucun module présentiel</h2><p className="muted" style={{ fontSize: 12.5 }}>Vous n'êtes inscrit·e à aucun module FACE2FACE pour l'instant. Rapprochez-vous de votre formateur.</p></div></div>
        : pid ? <ParticipantModule pid={pid} /> : null}
    </div>
  );
}

/* ================================================== CONSOLE FORMATEUR ===== */

/** Création de module : la grille du SOCLE COMMUN est reprise du parcours
 *  DECLICK publié correspondant (un seul contrat d'évaluation, zéro resaisie). */
function NewModuleForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState(1);
  const [location, setLocation] = useState("");
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [courseId, setCourseId] = useState("");
  const [trainers, setTrainers] = useState<UserRow[]>([]);
  const [trainerId, setTrainerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.courses().then((all) => setCourses(all.filter((c) => c.versions.some((v) => v.status === "PUBLISHED")))).catch(() => setCourses([]));
    api.users("").then((rows) => setTrainers(rows.filter((u) => ["INSTRUCTOR", "EVALUATOR", "COURSE_ADMIN", "SUPER_ADMIN"].includes(u.role)))).catch(() => setTrainers([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (!courseId) throw new Error("Choisissez le parcours source de la grille du socle");
      const course = await api.course(courseId);
      const published = course.versions.find((v) => v.status === "PUBLISHED");
      const rubric: Rubric | null = published ? rubricFromCourseContent(published.content) : null;
      if (!rubric) throw new Error("Grille du socle introuvable dans ce parcours");
      await api.createModule({ title, level, location: location || undefined, trainerId: trainerId || undefined, rubric });
      onCreated();
    } catch (err) { setError(errMsg(err, "Création impossible")); }
    finally { setBusy(false); }
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: 13 }}>
      <span className="eyebrow">Nouveau module présentiel</span>
      <h2>Créer un module FACE2FACE</h2>
      <div className="grid2">
        <label className="lbl">Intitulé<input className="field" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label className="lbl">Niveau K-SPEM
          <select className="field" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            <option value={1}>Niveau 1 — Fondamentaux (3 sessions · 2 périodes · journal 6)</option>
            <option value={2}>Niveau 2 — Avancé (4 sessions · 3 périodes · journal 9)</option>
            <option value={3}>Niveau 3 — Expert (5 sessions · 4 périodes · journal 12)</option>
          </select>
        </label>
        <label className="lbl">Lieu (optionnel)<input className="field" value={location} onChange={(e) => setLocation(e.target.value)} /></label>
        <label className="lbl">Formateur (optionnel)
          <select className="field" value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
            <option value="">—</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
          </select>
        </label>
      </div>
      <label className="lbl">Grille du socle commun — reprise du parcours publié
        <select className="field" value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
          <option value="">Choisir le parcours source…</option>
          {courses.map((c) => {
            const v = c.versions.find((x) => x.status === "PUBLISHED")!;
            return <option key={c.id} value={c.id}>{v.title} ({v.level})</option>;
          })}
        </select>
      </label>
      <p className="meta">Les {"sessions"} sont créées automatiquement selon la forme du niveau. La grille comportementale est celle du Bloc 4 du parcours choisi — même socle d'évaluation que DECLICK.</p>
      {error && <p className="ko">{error}</p>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" disabled={busy}>{busy ? "…" : "Créer le module"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

function ModulesList({ user, onOpen }: { user: Principal; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<ModuleRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => { api.modules().then(setRows).catch((e) => setError(errMsg(e, "Chargement impossible"))); }, []);
  useEffect(reload, [reload]);

  return (
    <>
      <div className="crumb">FACE2FACE / Cohortes & sessions</div>
      <div className="pagehead row between wrap">
        <div><h1>Modules présentiels</h1><div className="sub">Cohortes K-SPEM — sessions, émargement, journaux, certification</div></div>
        {canCreateModule(user.role) && !creating && <button className="btn" onClick={() => setCreating(true)}>+ Nouveau module</button>}
      </div>
      {creating && <NewModuleForm onCreated={() => { setCreating(false); reload(); }} onCancel={() => setCreating(false)} />}
      {error && <p className="ko">{error}</p>}
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Module</th><th>Niveau</th><th>Sessions</th><th>Participants</th><th>Formateur</th><th></th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={6} className="spin">Chargement…</td></tr>}
            {rows?.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 16 }}>Aucun module — créez le premier.</td></tr>}
            {rows?.map((m) => (
              <tr key={m.id}>
                <td><b>{m.title}</b>{m.location && <div className="meta">{m.location}</div>}</td>
                <td><span className="pill mint">N{m.level} · {m.shape.label}</span></td>
                <td className="num">{m.sessions.filter((s) => s.heldAt).length}/{m.shape.sessions} tenues</td>
                <td className="num">{m._count.participants}</td>
                <td>{m.trainer?.name ?? <span className="muted">—</span>}</td>
                <td><button className="btn ghost btn--sm" onClick={() => onOpen(m.id)}>Ouvrir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Émargement d'une session (rejouable — corrige une saisie erronée). */
function SessionRow({ s, participants, onHeld }: { s: ModuleSession; participants: ParticipantRow[]; onHeld: () => void }) {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    const init: Record<string, boolean> = {};
    for (const p of participants) {
      const a = s.attendance.find((x) => x.participantId === p.id);
      init[p.id] = a ? a.present : true;
    }
    setPresent(init); setOpen(true);
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      await api.holdSession(s.id, participants.map((p) => ({ participantId: p.id, present: Boolean(present[p.id]) })));
      setOpen(false); onHeld();
    } catch (err) { setError(errMsg(err, "Émargement impossible")); }
    finally { setBusy(false); }
  }

  const presentCount = s.attendance.filter((a) => a.present).length;
  return (
    <div className="step">
      <div className={`dot ${s.heldAt ? "done" : "next"}`}>{s.heldAt ? "✓" : s.index}</div>
      <div style={{ flex: 1 }}>
        <div className="row between wrap">
          <div>
            <b className="t">{s.title}</b>{" "}
            {s.heldAt
              ? <span className="pill ok">tenue · {fmtDate(s.heldAt)} · {presentCount}/{participants.length} présents</span>
              : <span className="pill soft">{s.scheduledAt ? `prévue le ${fmtDate(s.scheduledAt)}` : "à planifier"}</span>}
          </div>
          <button className="btn ghost btn--sm" onClick={open ? () => setOpen(false) : start}>{open ? "Fermer" : s.heldAt ? "Corriger l'émargement" : "Tenir la session"}</button>
        </div>
        {s.index === 1 && !s.heldAt && <div className="meta">⚠ Tenir la Session 1 fige définitivement les fiches d'ancrage de la cohorte.</div>}
        {open && (
          <div style={{ marginTop: 8, background: "var(--bg)", borderRadius: 10, padding: "8px 10px" }}>
            {participants.map((p) => (
              <label key={p.id} className="row" style={{ padding: "4px 0", fontSize: 12.5, cursor: "pointer" }}>
                <input type="checkbox" checked={Boolean(present[p.id])} onChange={(e) => setPresent({ ...present, [p.id]: e.target.checked })} />
                {p.user.name} <span className="meta">({p.user.email})</span>
              </label>
            ))}
            {error && <p className="ko">{error}</p>}
            <button className="btn btn--sm" style={{ marginTop: 6 }} disabled={busy || participants.length === 0} onClick={submit}>{busy ? "…" : "Valider l'émargement"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Fiche de notation : grille du socle, preuve par comportement, verrou §6. */
function CertifyPanel({ p, rubric, cs, onDone }: { p: ParticipantRow; rubric: Rubric; cs: CertState; onDone: () => void }) {
  const [scores, setScores] = useState<{ points: string; evidence: string }[]>(rubric.criteria.map(() => ({ points: "", evidence: "" })));
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.certify(p.id, {
        criteria: scores.map((s) => ({ points: Number(s.points), evidence: s.evidence || undefined })),
        feedback: feedback || undefined,
      });
      onDone();
    } catch (err) { setError(errMsg(err, "Décision impossible")); }
    finally { setBusy(false); }
  }

  if (!cs.ok) {
    return (
      <div className="card" style={{ borderColor: "#f2d9c4", background: "#fffcf9" }}>
        <span className="eyebrow">Grille comportementale</span>
        <h2>Certification verrouillée</h2>
        <p className="meta">🔒 K-SPEM §6 — la décision ne peut pas être prononcée tant qu'une condition manque. L'évaluateur voit précisément ce qui bloque, le participant aussi.</p>
        <button className="btn dis" style={{ marginTop: 8 }} disabled>Saisir la grille (verrouillée)</button>
      </div>
    );
  }

  const banded = rubric.criteria.some((c) => (c.bands ?? []).length > 0);
  return (
    <form className="card" onSubmit={submit}>
      <span className="eyebrow">Grille comportementale du socle commun · seuil {rubric.threshold}/100</span>
      <h2>Fiche de notation — {p.user.name}</h2>
      {rubric.criteria.map((c, i) => (
        <div key={i} style={{ borderTop: i ? "1px solid var(--line)" : "none", paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0 }}>
          <div className="row between wrap">
            <h2 style={{ fontSize: 13.5, margin: 0 }}>{c.label}</h2>
            <span className="meta">{c.weightPoints} pts{c.minPoints != null ? ` · minimum ${c.minPoints}` : ""}</span>
          </div>
          {c.bands && (
            <div className="bands">
              {[...c.bands].sort((a, b) => a.band - b.band).map((b) => {
                const pts = Number(scores[i].points);
                const sel = scores[i].points !== "" && pts >= b.scoreRange[0] && pts <= b.scoreRange[1];
                return <div className={`band${sel ? " sel" : ""}`} key={b.band}><b>Bande {b.band} · {b.scoreRange[0]}-{b.scoreRange[1]}</b>{b.descriptor}</div>;
              })}
            </div>
          )}
          <div className="row" style={{ alignItems: "flex-start" }}>
            <label className="lbl" style={{ width: 110, marginBottom: 0 }}>Points
              <input className="field" type="number" min={0} max={c.weightPoints} value={scores[i].points} required
                onChange={(e) => setScores(scores.map((s, j) => j === i ? { ...s, points: e.target.value } : s))} />
            </label>
            <label className="lbl" style={{ flex: 1, marginBottom: 0 }}>Preuve d'observation{banded ? " (obligatoire)" : ""}
              <textarea className="field" style={{ minHeight: 44 }} value={scores[i].evidence} required={banded}
                placeholder="Ce qui a été observé pendant la mise en situation, citable et daté…"
                onChange={(e) => setScores(scores.map((s, j) => j === i ? { ...s, evidence: e.target.value } : s))} />
            </label>
          </div>
        </div>
      ))}
      <label className="lbl" style={{ marginTop: 10 }}>Retour à la personne certifiée (optionnel)
        <textarea className="field" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </label>
      {error && <p className="ko">{error}</p>}
      <button className="btn btn--block" disabled={busy} style={{ marginTop: 6 }}>{busy ? "…" : "Prononcer la décision & émettre le badge FACE2FACE →"}</button>
      <p className="meta" style={{ marginTop: 8 }}>Décision du socle §6 (seuil + minimums non compensables), scellée définitivement. Si CERTIFIED : Open Badge 2.0 + certificat PDF <b>KOMPETENCES FACE2FACE</b> émis immédiatement.</p>
    </form>
  );
}

function Dossier({ p, rubric, user, onBack, onChanged }: { p: ParticipantRow; rubric: Rubric; user: Principal; onBack: () => void; onChanged: () => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [cs, setCs] = useState<CertState | null>(null);
  const reload = useCallback(() => {
    api.overview(p.id).then(setOv).catch(() => setOv(null));
    api.certState(p.id).then(setCs).catch(() => setCs(null));
  }, [p.id]);
  useEffect(reload, [reload]);

  if (!ov || !cs) return <div className="spin">Chargement du dossier…</div>;
  return (
    <>
      <button className="btn ghost btn--sm" onClick={onBack} style={{ marginBottom: 10 }}>← Retour à la cohorte</button>
      <div className="pagehead"><h1>{ov.user.name}</h1><div className="sub">{ov.user.email} · {ov.module.title} — Niveau {ov.module.level}</div></div>
      <div className="grid2">
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div className="card">
            <span className="eyebrow">Fiche d'ancrage — lecture formateur</span>
            {ov.anchor ? (
              <>
                <h2 style={{ fontSize: 13.5 }}>{ov.anchor.frozen ? `Figée (Session 1 tenue) · révision du ${fmtDate(ov.anchor.updatedAt)}` : "Encore modifiable (Session 1 non tenue)"}</h2>
                <p style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                  <b>Situation :</b> {ov.anchor.situation}<br />
                  <b>Comportement visé :</b> {ov.anchor.behaviorChange}<br />
                  <b>Bénéficiaires :</b> {ov.anchor.beneficiary}
                </p>
                {ov.anchor.frozen && <p className="meta">🔒 Lecture seule — plus modifiable depuis la fin de la Session 1. À revisiter en session finale.</p>}
              </>
            ) : <p className="muted" style={{ fontSize: 12.5 }}>Aucune fiche déposée.</p>}
          </div>
          <div className="card">
            <div className="row between"><span className="eyebrow">Journal de bord</span><span className={`pill ${ov.journal.count >= ov.journal.target ? "ok" : "warn"}`}>{ov.journal.count}/{ov.journal.target}</span></div>
            {ov.journal.entries.length === 0 && <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>Aucune entrée.</p>}
            {ov.journal.entries.map((e) => (
              <div className="step" key={e.id}>
                <div className="dot done">P{e.periodIndex}</div>
                <div>
                  <b className="t">{fmtDate(e.entryDate)} — {e.situation}</b>
                  <div className="meta"><b>Fait :</b> {e.action}</div>
                  <div className="meta"><b>Observé :</b> {e.observation} · <b>Appris :</b> {e.learning}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <span className="eyebrow">Missions terrain</span>
            {ov.missions.length === 0 && <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>Aucune mission consignée.</p>}
            {ov.missions.map((m) => (
              <div className="step" key={m.id}><div className="dot done">S{m.sessionIndex}</div>
                <div><p style={{ margin: 0, fontSize: 12.5 }}>« {m.text} »</p><div className="meta">{fmtDate(m.engagedAt)}{m.peerName ? ` · pair : ${m.peerName}` : ""}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div className="card">
            <span className="eyebrow">Conditions de certification (K-SPEM §6) — toutes requises</span>
            {cs.prereqs.map((pr) => (
              <div className="prereq" key={pr.code}><span className={pr.ok ? "ok-i" : "ko-i"}>{pr.ok ? "✓" : "✗"}</span> {pr.label}</div>
            ))}
            {cs.alreadyCertified
              ? <p className="okmsg">Décision prononcée : {cs.decision} — fiche scellée.</p>
              : cs.ok ? <p className="okmsg">✅ Grille déverrouillée — la décision certifiante peut être saisie.</p>
              : <p className="meta" style={{ marginTop: 8 }}>🔒 Grille verrouillée — le participant voit les mêmes conditions.</p>}
          </div>
          {ov.certification ? (
            <div className="card">
              <span className="eyebrow">Décision</span>
              <h2>{ov.certification.decision} · {ov.certification.scoreTotal}/100</h2>
              <p className="meta">Prononcée le {fmtDate(ov.certification.evaluatedAt)}</p>
              {(ov.certification.scores ?? []).map((s, i) => (
                <div className="prereq" key={i}>
                  <span className="num">{s.points}/{s.weightPoints}</span>
                  <div style={{ flex: 1 }}><b style={{ fontSize: 12 }}>{s.label}</b>{s.evidence && <div className="meta" style={{ fontStyle: "italic" }}>« {s.evidence} »</div>}</div>
                </div>
              ))}
              {ov.certification.feedback && <p style={{ fontSize: 12.5 }}>Retour : « {ov.certification.feedback} »</p>}
            </div>
          ) : canGrade(user.role) ? (
            <CertifyPanel p={p} rubric={rubric} cs={cs} onDone={() => { reload(); onChanged(); }} />
          ) : (
            <div className="card"><span className="eyebrow">Grille comportementale</span><p className="meta">La décision certifiante est réservée aux évaluateurs habilités (socle §5/§9).</p></div>
          )}
        </div>
      </div>
    </>
  );
}

function ModuleView({ id, user, onBack }: { id: string; user: Principal; onBack: () => void }) {
  const [m, setM] = useState<ModuleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<ParticipantRow | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => { api.module(id).then(setM).catch((e) => setError(errMsg(e, "Chargement impossible"))); }, [id]);
  useEffect(reload, [reload]);

  async function addParticipant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setAddErr(null);
    try { await api.addParticipant(id, { email: addEmail, name: addName || undefined }); setAddEmail(""); setAddName(""); reload(); }
    catch (err) { setAddErr(errMsg(err, "Inscription impossible")); }
    finally { setBusy(false); }
  }

  if (error) return <><button className="btn ghost btn--sm" onClick={onBack}>← Retour</button><p className="ko">{error}</p></>;
  if (!m) return <div className="spin">Chargement…</div>;

  if (dossier) {
    const fresh = m.participants.find((p) => p.id === dossier.id) ?? dossier;
    return <Dossier p={fresh} rubric={m.rubric} user={user} onBack={() => setDossier(null)} onChanged={reload} />;
  }

  return (
    <>
      <div className="crumb"><a onClick={onBack} style={{ cursor: "pointer" }}>FACE2FACE / Cohortes & sessions</a> / {m.title}</div>
      <div className="pagehead">
        <h1>{m.title}</h1>
        <div className="sub">Niveau {m.level} · {m.shape.label} — {m.shape.sessions} sessions · {m.shape.periods} périodes terrain · journal {m.shape.journalMin} entrées min{m.location ? ` · ${m.location}` : ""}{m.trainer ? ` · Formateur : ${m.trainer.name}` : ""}</div>
      </div>
      <div className="grid2">
        <div className="card">
          <span className="eyebrow">Calendrier du module · cycle APP</span>
          <h2>Sessions & émargement</h2>
          {m.sessions.map((s) => <SessionRow key={s.id} s={s} participants={m.participants} onHeld={reload} />)}
        </div>
        <div className="card">
          <div className="row between"><div><span className="eyebrow">Cohorte</span><h2>{m.participants.length} participant{m.participants.length > 1 ? "s" : ""}</h2></div></div>
          <form className="row wrap" onSubmit={addParticipant} style={{ marginBottom: 10 }}>
            <input className="field" style={{ flex: 2, minWidth: 160 }} type="email" placeholder="e-mail du participant" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} required />
            <input className="field" style={{ flex: 1, minWidth: 110 }} placeholder="nom (si nouveau)" value={addName} onChange={(e) => setAddName(e.target.value)} />
            <button className="btn btn--sm" disabled={busy}>{busy ? "…" : "Inscrire"}</button>
          </form>
          {addErr && <p className="ko" style={{ marginTop: -4, marginBottom: 8 }}>{addErr}</p>}
          <table className="table">
            <thead><tr><th>Participant</th><th>Présence</th><th>Journal</th><th>Missions</th><th>Ancrage</th><th>Certification</th><th></th></tr></thead>
            <tbody>
              {m.participants.map((p) => {
                const held = m.sessions.filter((s) => s.heldAt).length;
                return (
                  <tr key={p.id}>
                    <td><b>{p.user.name}</b><div className="meta">{p.user.email}</div></td>
                    <td><span className={`pill ${p.presentAt.length >= held ? "ok" : "red"}`}>{p.presentAt.length}/{held || 0}</span></td>
                    <td><span className={`pill ${p.journalCount >= p.journalTarget ? "ok" : p.journalCount > 0 ? "warn" : "soft"}`}>{p.journalCount}/{p.journalTarget}</span></td>
                    <td><span className={`pill ${p.missionCount >= m.shape.sessions - 1 ? "ok" : "soft"}`}>{p.missionCount}/{m.shape.sessions - 1}</span></td>
                    <td>{p.anchor.deposited ? <span className="pill mint">déposée</span> : <span className="pill soft">—</span>}</td>
                    <td>{p.certification
                      ? <span className={`pill ${p.certification.decision === "CERTIFIED" ? "ok" : "red"}`}>{p.certification.decision} · {p.certification.scoreTotal}</span>
                      : <span className="pill soft">à venir</span>}</td>
                    <td><button className="btn ghost btn--sm" onClick={() => setDossier(p)}>Dossier</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Console({ user, onLogout }: { user: Principal; onLogout: () => void }) {
  const [moduleId, setModuleId] = useState<string | null>(null);
  return (
    <div className="console">
      <div className="side">
        <div style={{ padding: "0 18px 16px" }}>
          <Lockup tagline size={13} />
        </div>
        <div className="nav">
          <a className="on" onClick={() => setModuleId(null)}>Cohortes & sessions</a>
        </div>
        <div style={{ padding: "18px 18px 0", fontSize: 11.5, color: "#9fb4d2" }}>
          {user.name}<br /><a style={{ textDecoration: "underline", cursor: "pointer" }} onClick={onLogout}>Déconnexion</a>
        </div>
      </div>
      <div className="main">
        {moduleId
          ? <ModuleView id={moduleId} user={user} onBack={() => setModuleId(null)} />
          : <ModulesList user={user} onOpen={setModuleId} />}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- App - */
export function App() {
  const [user, setUser] = useState<Principal | null>(auth.user());
  const logout = () => { auth.clear(); setUser(null); };
  if (!user) return <Login onLogin={setUser} />;
  return isStaffRole(user.role)
    ? <Console user={user} onLogout={logout} />
    : <ParticipantSpace user={user} onLogout={logout} />;
}
