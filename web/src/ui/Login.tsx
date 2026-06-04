import { useState } from "react";
import { api } from "../lib/app";
import { brand } from "../lib/brand";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.login(email, password); onLogin(); }
    catch { setError("Identifiants invalides"); }
    finally { setBusy(false); }
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 360, margin: "60px auto" }}>
      <h1>{brand.name}</h1>
      <p className="muted">Connexion apprenant · opéré par {brand.operator}</p>
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" placeholder="vous@exemple.com" required /></label>
      <label>Mot de passe<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
      {error && <p className="ko">{error}</p>}
      <button disabled={busy}>{busy ? "…" : "Se connecter"}</button>
    </form>
  );
}
