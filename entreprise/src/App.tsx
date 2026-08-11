import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api, auth, login as apiLogin, verify2fa, genPassword, publishedCourse, ApiError,
  type Org, type Seats, type Member, type CourseSummary, type Principal, type ProgressRow, type OrgImportReport,
} from "./api";

/** `Nom, Email` per line; separators , ; tab; a header row is skipped. */
function parseRows(text: string): { name: string; email: string }[] {
  const unquote = (x: string) => x.trim().replace(/^"(.*)"$/s, "$1").trim();
  const rows: { name: string; email: string }[] = [];
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split(/[;,\t]/).map(unquote);
    if (parts.length < 2 || !parts[1]) continue;
    const [name, email] = parts;
    if (/^(nom|name)$/i.test(name) || /^(e-?mail|courriel)$/i.test(email)) continue;
    rows.push({ name: name || email, email });
  }
  return rows;
}

/* ------------------------------------------------------------------ Login - */
function Login({ onLogin }: { onLogin: (u: Principal) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // 2FA step: the API answered « code required » — ask for the TOTP/backup code.
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
    }
    catch (err) { setError(err instanceof Error ? err.message : "Identifiants invalides"); }
    finally { setBusy(false); }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true); setError(null);
    try { const r = await verify2fa(challenge, code.trim()); auth.set(r.accessToken, r.user); onLogin(r.user); }
    catch (err) { setError(err instanceof Error ? err.message : "Code invalide"); }
    finally { setBusy(false); }
  }

  if (challenge) {
    return (
      <div className="login-wrap">
        <form className="card login-card" onSubmit={submitCode}>
          <div className="brandline"><img src="/logo-icon.png" alt="DECLICK DIGITAL" style={{ width: 34, height: 34, objectFit: "contain", verticalAlign: "middle", marginRight: 8 }} /><b>DECLICK</b> <span className="accent">DIGITAL</span></div>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Double authentification</div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>Saisissez le code de votre application d'authentification (ou un code de secours).</p>
          <label className="lbl">Code<input className="field" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" autoFocus required /></label>
          {error && <p className="ko">{error}</p>}
          <button className="btn btn--primary" disabled={busy || code.trim().length < 6} style={{ justifyContent: "center", padding: 11, marginTop: 6 }}>{busy ? "…" : "Valider"}</button>
          <button type="button" className="btn" style={{ justifyContent: "center", padding: 9, marginTop: 8 }} onClick={() => { setChallenge(null); setCode(""); setError(null); }}>← Retour</button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="brandline"><img src="/logo-icon.png" alt="DECLICK DIGITAL" style={{ width: 34, height: 34, objectFit: "contain", verticalAlign: "middle", marginRight: 8 }} /><b>DECLICK</b> <span className="accent">DIGITAL</span></div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Espace entreprise</div>
        <label className="lbl">E-mail<input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label className="lbl">Mot de passe<input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="ko">{error}</p>}
        <button className="btn btn--primary" disabled={busy} style={{ justifyContent: "center", padding: 11, marginTop: 6 }}>{busy ? "…" : "Se connecter"}</button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------- Seats card - */
function SeatsCard({ seats }: { seats: Seats }) {
  const pct = seats.seats > 0 ? Math.min(100, Math.round((seats.used / seats.seats) * 100)) : 0;
  const full = seats.available <= 0;
  return (
    <div className="card">
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="row between">
          <div><div className="eyebrow">Licences</div><div style={{ fontSize: 26, fontWeight: 800 }}>{seats.used} / {seats.seats}</div></div>
          <span className={`pill ${full ? "pill--red" : "pill--green"}`}>{seats.available} disponible{seats.available > 1 ? "s" : ""}</span>
        </div>
        <div className="bar"><i style={{ width: `${pct}%`, background: full ? "var(--danger)" : "var(--accent)" }} /></div>
        {seats.seats === 0 && <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Aucun siège configuré. Contactez DECLICK pour activer vos licences.</p>}
        {full && seats.seats > 0 && <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Toutes les licences sont utilisées. Désactivez un compte pour libérer un siège, ou contactez DECLICK.</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Add learner - */
function AddLearner({ orgId, selectedCourse, full, onDone }: {
  orgId: string; selectedCourse: string; full: boolean; onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState(genPassword());
  const [enrol, setEnrol] = useState(true);
  const [invite, setInvite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setResult(null);
    try {
      const u = await api.createLearner(orgId, { name: name.trim(), email: email.trim(), password: pwd, invite });
      let enrolMsg = "";
      if (enrol && selectedCourse) {
        try { await api.enroll(orgId, u.id, selectedCourse); enrolMsg = " Inscrit·e au parcours."; }
        catch (err) { enrolMsg = ` ⚠️ Compte créé mais inscription au parcours échouée : ${err instanceof ApiError ? err.message : "erreur"}.`; }
      }
      setResult({ ok: true, msg: `✅ ${u.name} créé·e.${enrolMsg} ${u.invited ? "Invitation envoyée." : "Identifiants : " + u.email + " / " + pwd}` });
      setName(""); setEmail(""); setPwd(genPassword());
      onDone();
    } catch (err) {
      setResult({ ok: false, msg: err instanceof ApiError ? err.message : "Erreur" });
    } finally { setBusy(false); }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-h"><h3>Ajouter un apprenant</h3></div>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="lbl">Nom complet<input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aminata Diallo" required /></label>
        <label className="lbl">E-mail<input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aminata.d@exemple.com" required /></label>
        <label className="lbl">Mot de passe initial
          <div className="row" style={{ gap: 8 }}>
            <input className="field" style={{ fontFamily: "monospace" }} value={pwd} onChange={(e) => setPwd(e.target.value)} required />
            <button type="button" className="btn btn--sm" onClick={() => setPwd(genPassword())}>Générer</button>
          </div>
        </label>
        <label className="check"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} /> Envoyer l'invitation par e-mail</label>
        {selectedCourse && <label className="check"><input type="checkbox" checked={enrol} onChange={(e) => setEnrol(e.target.checked)} /> Inscrire au parcours sélectionné</label>}
        <button className="btn btn--primary" disabled={busy || full} style={{ justifyContent: "center", padding: 11 }}>{busy ? "…" : full ? "Licences épuisées" : "Créer et inviter"}</button>
        {result && <div className="card" style={{ background: result.ok ? "var(--success-tint)" : "var(--danger-tint)", border: "none", padding: "10px 12px", fontSize: 13 }}>{result.msg}</div>}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------- Import CSV - */
function ImportCard({ orgId, selectedCourse, available, onDone }: {
  orgId: string; selectedCourse: string; available: number; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [invite, setInvite] = useState(true);
  const [enrol, setEnrol] = useState(true);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<OrgImportReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = parseRows(csv);

  function loadFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    void f.text().then((t) => setCsv(t));
    if (fileRef.current) fileRef.current.value = "";
  }
  async function run() {
    setBusy(true); setErr(null); setReport(null);
    try { setReport(await api.importLearners(orgId, rows, { courseId: enrol && selectedCourse ? selectedCourse : undefined, invite })); onDone(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Import impossible"); }
    finally { setBusy(false); }
  }
  function downloadCreds() {
    const lines = ["Email,Mot de passe", ...(report?.credentials ?? []).map((c) => `"${c.email}","${c.password}"`)];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" }));
    a.download = "identifiants-apprenants.csv"; a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>Import CSV</h3>
        <button className="btn btn--sm" onClick={() => setOpen((v) => !v)}>{open ? "Fermer" : "Ouvrir"}</button>
      </div>
      {open && (
        <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files)} />
            <button className="btn btn--sm" onClick={() => fileRef.current?.click()}>📄 Charger un fichier…</button>
            <span className="muted" style={{ fontSize: 12 }}>ou collez <code>Nom, Email</code> (une ligne par apprenant)</span>
          </div>
          <textarea className="field" style={{ minHeight: 100, fontFamily: "monospace", fontSize: 12.5, resize: "vertical" }} value={csv}
            onChange={(e) => { setCsv(e.target.value); setReport(null); }} placeholder={"Aminata Diallo, aminata.d@exemple.com\nKouamé N'Guessan, kouame.n@exemple.com"} />
          <label className="check"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} /> Envoyer les invitations par e-mail</label>
          {selectedCourse && <label className="check"><input type="checkbox" checked={enrol} onChange={(e) => setEnrol(e.target.checked)} /> Inscrire au parcours sélectionné</label>}
          <div className="row between">
            <span className="muted" style={{ fontSize: 12 }}>{rows.length} apprenant(s) détecté(s) · {available} siège(s) disponible(s)</span>
            <button className="btn btn--primary btn--sm" disabled={busy || rows.length === 0 || rows.length > available} onClick={() => void run()}>
              {busy ? "Import…" : rows.length > available ? "Licences insuffisantes" : "Importer"}
            </button>
          </div>
          {err && <p className="ko">{err}</p>}
          {report && (
            <div className="card" style={{ border: "1px solid var(--line)", padding: "10px 12px", fontSize: 12.5 }}>
              <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: report.errors.length ? 8 : 0 }}>
                <span className="pill pill--green">{report.created} créé(s)</span>
                {report.enrolled > 0 && <span className="pill pill--soft">{report.enrolled} inscrit(s)</span>}
                {invite && <span className="pill pill--soft">{report.invited} invitation(s)</span>}
                {report.errors.length > 0 && <span className="pill pill--red">{report.errors.length} erreur(s)</span>}
                {report.credentials.length > 0 && <button className="btn btn--sm" onClick={downloadCreds}>⤓ Identifiants</button>}
              </div>
              {report.errors.map((e, i) => <div key={i} className="ko" style={{ margin: 0 }}>Ligne {e.line} · {e.email || "—"} : {e.error}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Team -- */
function TeamCard({ orgId, members, me, onChange }: {
  orgId: string; members: Member[]; me: Principal; onChange: () => void;
}) {
  const team = members.filter((m) => m.orgRole !== "MEMBER");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add"); setNote(null);
    try { await api.addTeamMember(orgId, email.trim(), "ADMIN"); setNote(`✅ ${email.trim()} est maintenant administrateur.`); setEmail(""); onChange(); }
    catch (err) { setNote(err instanceof ApiError ? err.message : "Erreur"); }
    finally { setBusy(null); }
  }
  async function remove(m: Member) {
    setBusy(m.user.id); setNote(null);
    try { await api.removeTeamMember(orgId, m.user.id); onChange(); }
    catch (err) { setNote(err instanceof ApiError ? err.message : "Erreur"); }
    finally { setBusy(null); }
  }

  return (
    <div className="card">
      <div className="card-h"><h3>Équipe <span className="muted">({team.length})</span></h3></div>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {team.map((m) => (
          <div key={m.user.id} className="row between">
            <div className="who" style={{ minWidth: 0 }}>
              <b style={{ fontSize: 13 }}>{m.user.name}{m.user.id === me.id ? " (vous)" : ""}</b>
              <span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{m.user.email}</span>
            </div>
            <div className="row" style={{ gap: 6, flexShrink: 0 }}>
              <span className={`pill ${m.orgRole === "OWNER" ? "pill--green" : "pill--soft"}`}>{m.orgRole === "OWNER" ? "Propriétaire" : "Administrateur"}</span>
              {m.user.id !== me.id && <button className="btn btn--sm" disabled={busy === m.user.id} onClick={() => void remove(m)} title="Retirer de l'équipe d'administration">✕</button>}
            </div>
          </div>
        ))}
        <form className="row" style={{ gap: 8 }} onSubmit={add}>
          <input className="field" type="email" style={{ flex: 1, padding: "8px 10px", fontSize: 12.5 }} placeholder="E-mail d'un compte existant…" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn btn--sm" disabled={busy === "add" || !email.trim()}>{busy === "add" ? "…" : "+ Admin"}</button>
        </form>
        <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>Les administrateurs gèrent apprenants et licences. Ils ne consomment pas de siège.</p>
        {note && <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>{note}</p>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Learners - */
function Learners({ orgId, members, progress, selectedCourse, onChange }: {
  orgId: string; members: Member[]; progress: Map<string, ProgressRow>; selectedCourse: string; onChange: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const learners = members.filter((m) => m.orgRole === "MEMBER")
    .filter((m) => q.trim() === "" || (m.user.name + " " + m.user.email).toLowerCase().includes(q.trim().toLowerCase()));

  async function toggle(m: Member) {
    const disabling = m.user.disabledAt == null;
    setBusyId(m.user.id); setNote(null);
    try { await api.setDisabled(orgId, m.user.id, disabling); onChange(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }
  async function enrol(m: Member) {
    if (!selectedCourse) { setNote("Sélectionnez un parcours en haut."); return; }
    setBusyId(m.user.id); setNote(null);
    try { await api.enroll(orgId, m.user.id, selectedCourse); setNote(`✅ ${m.user.name} inscrit·e au parcours.`); onChange(); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }
  async function reinvite(m: Member) {
    setBusyId(m.user.id); setNote(null);
    try {
      const r = await api.resendInvite(orgId, m.user.id);
      setNote(r.delivered
        ? `✅ Invitation renvoyée à ${m.user.email} (nouveau mot de passe envoyé).`
        : `⚠️ Envoi non configuré — communiquez ce mot de passe à ${m.user.email} : ${r.tempPassword}`);
    } catch (e) { setNote(e instanceof ApiError ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }
  async function exportCsv() {
    try {
      const blob = await api.progressCsv(orgId);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "progression-apprenants.csv"; a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setNote(e instanceof ApiError ? e.message : "Export impossible"); }
  }

  const statusFr: Record<string, string> = { ACTIVE: "En cours", CERTIFIED: "Certifié", COMPLETED: "Terminé" };

  return (
    <div className="card">
      <div className="card-h">
        <h3>Apprenants <span className="muted">({learners.length})</span></h3>
        <div className="row" style={{ gap: 8 }}>
          <input className="field" style={{ width: 180, padding: "7px 10px", fontSize: 12.5 }} placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn--sm" onClick={() => void exportCsv()} title="Exporter la progression de tous les apprenants (CSV Excel)">⤓ CSV</button>
        </div>
      </div>
      <div className="card-b">
        {note && <p style={{ marginTop: 0, fontSize: 13, fontWeight: 600 }}>{note}</p>}
        {learners.length === 0
          ? <p className="muted">{q ? "Aucun apprenant ne correspond à cette recherche." : "Aucun apprenant pour l'instant. Ajoutez-en un avec le formulaire."}</p>
          : (
            <table className="table">
              <thead><tr><th>Apprenant</th><th>Parcours & progression</th><th>Statut</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
              <tbody>
                {learners.map((m) => {
                  const disabled = m.user.disabledAt != null;
                  const p = progress.get(m.user.id);
                  return (
                    <tr key={m.user.id}>
                      <td><div className="who"><b style={{ fontSize: 13 }}>{m.user.name}</b><span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{m.user.email}</span></div></td>
                      <td>
                        {!p || p.enrollments.length === 0
                          ? <span className="muted" style={{ fontSize: 12 }}>Aucune inscription</span>
                          : p.enrollments.map((e, i) => (
                            <div key={i} style={{ marginBottom: i < p.enrollments.length - 1 ? 8 : 0 }}>
                              <div style={{ fontSize: 12, marginBottom: 2 }}>{e.courseTitle}
                                {e.status === "CERTIFIED" && <span className="pill pill--green" style={{ fontSize: 10, marginLeft: 6 }}>Certifié</span>}
                              </div>
                              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                                <div className="bar" style={{ flex: 1, maxWidth: 180 }}><i style={{ width: `${Math.max(e.progressPercent, 2)}%`, background: e.progressPercent === 100 ? "var(--green, #2DAA4F)" : "var(--accent)" }} /></div>
                                <b style={{ fontSize: 12 }}>{e.progressPercent}%</b>
                                <span className="muted" style={{ fontSize: 11 }}>{statusFr[e.status] ?? e.status}</span>
                              </div>
                            </div>
                          ))}
                      </td>
                      <td>{disabled ? <span className="pill pill--red">Désactivé</span> : <span className="pill pill--green">Actif</span>}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {!disabled && <button className="btn btn--sm" disabled={busyId === m.user.id} onClick={() => enrol(m)} style={{ marginRight: 6 }}>Inscrire</button>}
                        {!disabled && <button className="btn btn--sm" disabled={busyId === m.user.id} onClick={() => reinvite(m)} style={{ marginRight: 6 }} title="Réinitialise le mot de passe et renvoie l'invitation">↻ Inviter</button>}
                        <button className="btn btn--sm" disabled={busyId === m.user.id} onClick={() => toggle(m)}>{disabled ? "Réactiver" : "Désactiver"}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Console -- */
function Console({ user, onLogout }: { user: Principal; onLogout: () => void }) {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [orgId, setOrgId] = useState<string>("");
  const [seats, setSeats] = useState<Seats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [progress, setProgress] = useState<Map<string, ProgressRow>>(new Map());
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const org = useMemo(() => orgs?.find((o) => o.id === orgId) ?? null, [orgs, orgId]);
  const enrolCourses = useMemo(() => courses.filter((c) => publishedCourse(c)), [courses]);

  useEffect(() => {
    (async () => {
      try {
        const [os, cs] = await Promise.all([api.myOrgs(), api.courses().catch(() => [])]);
        setOrgs(os); setCourses(cs);
        if (os.length > 0) setOrgId(os[0]!.id); else setError("Aucune organisation associée à votre compte.");
      } catch (e) { setError(e instanceof Error ? e.message : "Erreur de chargement"); }
    })();
  }, []);

  const loadOrg = useCallback(async (id: string) => {
    if (!id) return;
    setForbidden(false); setError(null); setLoading(true);
    try {
      const [s, m, p] = await Promise.all([api.seats(id), api.members(id), api.progress(id).catch(() => [] as ProgressRow[])]);
      setSeats(s); setMembers(m); setProgress(new Map(p.map((r) => [r.userId, r])));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) { setForbidden(true); setSeats(null); setMembers([]); }
      else setError(e instanceof Error ? e.message : "Erreur");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadOrg(orgId); }, [orgId, loadOrg]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brandline" style={{ display: "flex", alignItems: "center", gap: 8 }}><img src="/logo-icon.png" alt="DECLICK DIGITAL" style={{ width: 30, height: 30, objectFit: "contain" }} /><span><b>DECLICK</b> <span className="accent">DIGITAL</span> <span className="topbar-sub">Espace entreprise</span></span></div>
        <div className="row" style={{ gap: 12 }}>
          {orgs && orgs.length > 1 && (
            <select className="select" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <span className="muted" style={{ fontSize: 13 }}>{user.name}</span>
          <button className="btn btn--sm" onClick={onLogout}>Déconnexion</button>
        </div>
      </header>

      <main className="content">
        <div className="pagehead">
          <div>
            <div className="eyebrow">Organisation</div>
            <h1>{org?.name ?? "…"}</h1>
            <div className="sub">Gérez vos apprenants et vos licences en self-service.</div>
          </div>
          {enrolCourses.length > 0 && (
            <select className="select" value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
              <option value="">— Parcours (pour inscrire) —</option>
              {enrolCourses.map((c) => { const p = publishedCourse(c)!; return <option key={c.id} value={c.id}>{p.title} ({p.level})</option>; })}
            </select>
          )}
        </div>

        {error && <div className="card" style={{ background: "var(--danger-tint)", border: "none", padding: "12px 14px", marginBottom: 16 }}>{error}</div>}
        {forbidden && <div className="card" style={{ background: "var(--danger-tint)", border: "none", padding: "12px 14px", marginBottom: 16 }}>
          Votre compte n'est pas administrateur de cette organisation. Demandez à DECLICK de vous accorder le rôle administrateur.
        </div>}

        {!forbidden && !seats && !error && (
          <div className="card" style={{ padding: "22px 16px" }}><span className="muted">Chargement de l'organisation…</span></div>
        )}
        {!forbidden && seats && (
          <div className="grid grid-console" style={{ alignItems: "start", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SeatsCard seats={seats} />
              <AddLearner orgId={orgId} selectedCourse={selectedCourse} full={seats.available <= 0} onDone={() => loadOrg(orgId)} />
              <ImportCard orgId={orgId} selectedCourse={selectedCourse} available={seats.available} onDone={() => loadOrg(orgId)} />
              <TeamCard orgId={orgId} members={members} me={user} onChange={() => loadOrg(orgId)} />
            </div>
            <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
              <Learners orgId={orgId} members={members} progress={progress} selectedCourse={selectedCourse} onChange={() => loadOrg(orgId)} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ App -- */
export function App() {
  const [user, setUser] = useState<Principal | null>(() => auth.user());
  useEffect(() => { document.title = "DECLICK DIGITAL — Espace entreprise"; }, []);
  if (!user || !auth.token()) return <Login onLogin={setUser} />;
  return <Console user={user} onLogout={() => { auth.clear(); setUser(null); }} />;
}
