import { useState } from "react";
import { login, verify2fa, auth, isStaff, type Principal } from "../lib/api";

export function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null); // set when 2FA is required
  const [code, setCode] = useState("");

  // Shared post-auth handling: staff gate → store → done.
  function finish(accessToken: string, user: Principal): boolean {
    if (!isStaff(user.role)) { setErr("Accès réservé au personnel (administration)."); return false; }
    auth.set(accessToken, user); onDone(); return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await login(email.trim(), password);
      if ("twoFactorRequired" in r) { setChallenge(r.challenge); setBusy(false); return; }
      if (!finish(r.accessToken, r.user)) setBusy(false);
    } catch (e: any) { setErr(e?.message || "Identifiants invalides"); setBusy(false); }
  }

  async function submit2fa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await verify2fa(challenge!, code.trim());
      if (!finish(r.accessToken, r.user)) setBusy(false);
    } catch (e: any) { setErr(e?.message || "Code invalide"); setBusy(false); }
  }

  const card: React.CSSProperties = { width: 380, background: "#fff", borderRadius: 18, padding: 30, boxShadow: "var(--shadow-lg)" };
  const field: React.CSSProperties = { width: "100%", padding: "11px 13px", border: "1px solid var(--line-strong)", borderRadius: 10, fontFamily: "inherit", fontSize: 14 };
  const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--fg-1)" };
  const Logo = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <img src="/logo-icon.png" width={34} height={34} style={{ objectFit: "contain" }} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--navy-700)", letterSpacing: ".01em" }}>DECLICK <span style={{ color: "var(--green)" }}>DIGITAL</span></span>
    </div>
  );

  if (challenge) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--navy-800)" }}>
        <form onSubmit={submit2fa} style={card}>
          {Logo}
          <h1 style={{ fontSize: 22, marginTop: 14 }}>Vérification en deux étapes</h1>
          <p className="muted" style={{ margin: "4px 0 18px", fontSize: 13 }}>Saisissez le code à 6 chiffres de votre application d'authentification (ou un code de secours).</p>
          <label style={lbl}>Code</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoFocus autoComplete="one-time-code" placeholder="123456"
            style={{ ...field, letterSpacing: "0.25em", marginBottom: 16 }} />
          {err && <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 14px", fontWeight: 600 }}>{err}</p>}
          <button className="btn btn--primary" disabled={busy || code.trim().length < 6} style={{ width: "100%", justifyContent: "center", padding: "12px" }}>{busy ? "…" : "Vérifier"}</button>
          <button type="button" className="btn btn--ghost" style={{ width: "100%", justifyContent: "center", padding: "10px", marginTop: 8 }} onClick={() => { setChallenge(null); setCode(""); setErr(null); }}>← Annuler</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--navy-800)" }}>
      <form onSubmit={submit} style={card}>
        {Logo}
        <h1 style={{ fontSize: 22, marginTop: 14 }}>Administration</h1>
        <p className="muted" style={{ margin: "4px 0 18px", fontSize: 13 }}>Console réservée au personnel KOMPETENCES DECLICK.</p>
        <label style={lbl}>E-mail</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username" placeholder="admin@kompetences.net" style={{ ...field, marginBottom: 14 }} />
        <label style={lbl}>Mot de passe</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password" style={{ ...field, marginBottom: 16 }} />
        {err && <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 14px", fontWeight: 600 }}>{err}</p>}
        <button className="btn btn--primary" disabled={busy} style={{ width: "100%", justifyContent: "center", padding: "12px" }}>{busy ? "…" : "Se connecter"}</button>
      </form>
    </div>
  );
}
