import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api, auth, login as apiLogin, genPassword, publishedCourse, ApiError,
  type Org, type Seats, type Member, type CourseSummary, type Principal,
} from "./api";

/* ------------------------------------------------------------------ Login - */
function Login({ onLogin }: { onLogin: (u: Principal) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { const r = await apiLogin(email, password); auth.set(r.accessToken, r.user); onLogin(r.user); }
    catch (err) { setError(err instanceof Error ? err.message : "Identifiants invalides"); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="brandline"><b>DECLICK</b> <span className="accent">DIGITAL</span></div>
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
  const [phone, setPhone] = useState("");
  const [pwd, setPwd] = useState(genPassword());
  const [enrol, setEnrol] = useState(true);
  const [invite, setInvite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setResult(null);
    try {
      const u = await api.createLearner(orgId, { name: name.trim(), email: email.trim(), password: pwd, phone: phone.trim() || undefined, invite });
      if (enrol && selectedCourse) { try { await api.enroll(orgId, u.id, selectedCourse); } catch { /* non-fatal */ } }
      setResult({ ok: true, msg: `✅ ${u.name} créé·e. ${u.invited ? "Invitation envoyée." : "Identifiants : " + u.email + " / " + pwd}` });
      setName(""); setEmail(""); setPhone(""); setPwd(genPassword());
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
        <label className="lbl">Téléphone <span className="muted">(optionnel — invitation WhatsApp)</span><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+225 07 00 00 00 00" /></label>
        <label className="lbl">Mot de passe initial
          <div className="row" style={{ gap: 8 }}>
            <input className="field" style={{ fontFamily: "monospace" }} value={pwd} onChange={(e) => setPwd(e.target.value)} required />
            <button type="button" className="btn btn--sm" onClick={() => setPwd(genPassword())}>Générer</button>
          </div>
        </label>
        <label className="check"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} /> Envoyer l'invitation (e-mail + WhatsApp)</label>
        {selectedCourse && <label className="check"><input type="checkbox" checked={enrol} onChange={(e) => setEnrol(e.target.checked)} /> Inscrire au parcours sélectionné</label>}
        <button className="btn btn--primary" disabled={busy || full} style={{ justifyContent: "center", padding: 11 }}>{busy ? "…" : full ? "Licences épuisées" : "Créer et inviter"}</button>
        {result && <div className="card" style={{ background: result.ok ? "var(--success-tint)" : "var(--danger-tint)", border: "none", padding: "10px 12px", fontSize: 13 }}>{result.msg}</div>}
      </div>
    </form>
  );
}

/* --------------------------------------------------------------- Learners - */
function Learners({ orgId, members, selectedCourse, onChange }: {
  orgId: string; members: Member[]; selectedCourse: string; onChange: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const learners = members.filter((m) => m.orgRole === "MEMBER");

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
    try { await api.enroll(orgId, m.user.id, selectedCourse); setNote(`${m.user.name} inscrit·e au parcours.`); }
    catch (e) { setNote(e instanceof ApiError ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }

  return (
    <div className="card">
      <div className="card-h"><h3>Apprenants <span className="muted">({learners.length})</span></h3></div>
      <div className="card-b">
        {note && <p className="muted" style={{ marginTop: 0 }}>{note}</p>}
        {learners.length === 0
          ? <p className="muted">Aucun apprenant pour l'instant. Ajoutez-en un avec le formulaire.</p>
          : (
            <table className="table">
              <thead><tr><th>Apprenant</th><th>Statut</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
              <tbody>
                {learners.map((m) => {
                  const disabled = m.user.disabledAt != null;
                  return (
                    <tr key={m.user.id}>
                      <td><div className="who"><b style={{ fontSize: 13 }}>{m.user.name}</b><span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{m.user.email}</span></div></td>
                      <td>{disabled ? <span className="pill pill--red">Désactivé</span> : <span className="pill pill--green">Actif</span>}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {!disabled && <button className="btn btn--sm" disabled={busyId === m.user.id} onClick={() => enrol(m)} style={{ marginRight: 6 }}>Inscrire</button>}
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
    setForbidden(false); setError(null);
    try {
      const [s, m] = await Promise.all([api.seats(id), api.members(id)]);
      setSeats(s); setMembers(m);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) { setForbidden(true); setSeats(null); setMembers([]); }
      else setError(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => { void loadOrg(orgId); }, [orgId, loadOrg]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brandline"><b>DECLICK</b> <span className="accent">DIGITAL</span> <span className="topbar-sub">Espace entreprise</span></div>
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

        {!forbidden && seats && (
          <div className="grid" style={{ gridTemplateColumns: "1fr 1.4fr", alignItems: "start", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SeatsCard seats={seats} />
              <AddLearner orgId={orgId} selectedCourse={selectedCourse} full={seats.available <= 0} onDone={() => loadOrg(orgId)} />
            </div>
            <Learners orgId={orgId} members={members} selectedCourse={selectedCourse} onChange={() => loadOrg(orgId)} />
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
