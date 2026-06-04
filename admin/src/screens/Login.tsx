import { useState } from "react";
import { login, auth, isStaff } from "../lib/api";

export function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { accessToken, user } = await login(email.trim(), password);
      if (!isStaff(user.role)) { setErr("Accès réservé au personnel (administration)."); setBusy(false); return; }
      auth.set(accessToken, user);
      onDone();
    } catch (e: any) { setErr(e?.message || "Identifiants invalides"); setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--navy-800)" }}>
      <form onSubmit={submit} style={{ width: 380, background: "#fff", borderRadius: 18, padding: 30, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <img src="/logo-icon.png" width={34} height={34} style={{ objectFit: "contain" }} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--navy-700)", letterSpacing: ".01em" }}>DECLICK <span style={{ color: "var(--green)" }}>DIGITAL</span></span>
        </div>
        <h1 style={{ fontSize: 22, marginTop: 14 }}>Administration</h1>
        <p className="muted" style={{ margin: "4px 0 18px", fontSize: 13 }}>Console réservée au personnel KOMPETENCES DECLICK.</p>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--fg-1)" }}>E-mail</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username" placeholder="admin@kompetences.net"
          style={{ width: "100%", padding: "11px 13px", border: "1px solid var(--line-strong)", borderRadius: 10, fontFamily: "inherit", fontSize: 14, marginBottom: 14 }} />
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--fg-1)" }}>Mot de passe</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password"
          style={{ width: "100%", padding: "11px 13px", border: "1px solid var(--line-strong)", borderRadius: 10, fontFamily: "inherit", fontSize: 14, marginBottom: 16 }} />
        {err && <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 14px", fontWeight: 600 }}>{err}</p>}
        <button className="btn btn--primary" disabled={busy} style={{ width: "100%", justifyContent: "center", padding: "12px" }}>{busy ? "…" : "Se connecter"}</button>
      </form>
    </div>
  );
}
