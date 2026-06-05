import { useState } from "react";
import { api, setIdentity } from "../lib/app";
import { brand } from "../lib/brand";

type Mode = "login" | "signup" | "verify" | "forgot" | "reset";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — must stay empty
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = (u: { id: string; name: string; email: string }) => { setIdentity({ id: u.id, name: u.name, email: u.email }); onLogin(); };

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { done(await api.login(email, password)); }
    catch (err: any) {
      if (err?.code === "email_unverified") { setMode("verify"); setInfo("Votre e-mail n'est pas encore vérifié. Saisissez le code reçu (ou renvoyez-en un)."); setError(null); }
      else setError(err?.message || "Identifiants invalides");
    } finally { setBusy(false); }
  }

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api.register({ name: name.trim(), email: email.trim(), password, phone: phone.trim() || undefined, ...(website ? { website } as any : {}) });
      setMode("verify"); setInfo(`Un code de vérification a été envoyé à ${email}.`);
    } catch (err: any) { setError(err?.message || "Inscription impossible"); }
    finally { setBusy(false); }
  }

  async function submitVerify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { done(await api.verify(email.trim(), code.trim())); }
    catch (err: any) { setError(err?.message || "Code invalide"); }
    finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setError(null);
    try { await api.resendVerification(email.trim()); setInfo("Nouveau code envoyé. Vérifiez votre boîte mail (et les indésirables)."); }
    finally { setBusy(false); }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api.forgotPassword(email.trim()); setMode("reset"); setInfo(`Si un compte existe pour ${email}, un code de réinitialisation a été envoyé.`); setPassword(""); }
    finally { setBusy(false); }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { done(await api.resetPassword(email.trim(), code.trim(), password)); }
    catch (err: any) { setError(err?.message || "Réinitialisation impossible"); }
    finally { setBusy(false); }
  }

  const card: React.CSSProperties = { maxWidth: 360, margin: "60px auto" };

  if (mode === "signup") {
    return (
      <form className="card" onSubmit={submitSignup} style={card}>
        <h1>{brand.name}</h1>
        <p className="muted">Créer un compte · opéré par {brand.operator}</p>
        <label>Nom complet<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="vous@exemple.com" required /></label>
        <label>Téléphone <span className="muted">(optionnel)</span><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="+225 07 00 00 00 00" /></label>
        <label>Mot de passe<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={10} placeholder="10 caractères minimum" required /></label>
        {/* honeypot: hidden from users, tab-skipped */}
        <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} />
        {error && <p className="ko">{error}</p>}
        <button disabled={busy}>{busy ? "…" : "Créer mon compte"}</button>
        <p className="muted" style={{ marginTop: 12, textAlign: "center" }}>Déjà inscrit ? <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(null); setInfo(null); }}>Se connecter</a></p>
      </form>
    );
  }

  if (mode === "verify") {
    return (
      <form className="card" onSubmit={submitVerify} style={card}>
        <h1>Vérification</h1>
        {info && <p className="muted">{info}</p>}
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
        <label>Code de vérification<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="6 chiffres" required /></label>
        {error && <p className="ko">{error}</p>}
        <button disabled={busy}>{busy ? "…" : "Vérifier et se connecter"}</button>
        <p className="muted" style={{ marginTop: 12, textAlign: "center" }}>
          <a href="#" onClick={(e) => { e.preventDefault(); void resend(); }}>Renvoyer le code</a> · <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(null); setInfo(null); }}>Retour</a>
        </p>
      </form>
    );
  }

  if (mode === "forgot") {
    return (
      <form className="card" onSubmit={submitForgot} style={card}>
        <h1>Mot de passe oublié</h1>
        <p className="muted">Saisissez votre e-mail : nous vous enverrons un code pour définir un nouveau mot de passe.</p>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
        {error && <p className="ko">{error}</p>}
        <button disabled={busy}>{busy ? "…" : "Envoyer le code"}</button>
        <p className="muted" style={{ marginTop: 12, textAlign: "center" }}><a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(null); setInfo(null); }}>Retour</a></p>
      </form>
    );
  }

  if (mode === "reset") {
    return (
      <form className="card" onSubmit={submitReset} style={card}>
        <h1>Nouveau mot de passe</h1>
        {info && <p className="muted">{info}</p>}
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
        <label>Code reçu<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="6 chiffres" required /></label>
        <label>Nouveau mot de passe<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={10} placeholder="10 caractères minimum" required /></label>
        {error && <p className="ko">{error}</p>}
        <button disabled={busy}>{busy ? "…" : "Réinitialiser et se connecter"}</button>
        <p className="muted" style={{ marginTop: 12, textAlign: "center" }}><a href="#" onClick={(e) => { e.preventDefault(); void api.forgotPassword(email.trim()); setInfo("Nouveau code envoyé."); }}>Renvoyer le code</a> · <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(null); setInfo(null); }}>Retour</a></p>
      </form>
    );
  }

  return (
    <form className="card" onSubmit={submitLogin} style={card}>
      <h1>{brand.name}</h1>
      <p className="muted">Connexion apprenant · opéré par {brand.operator}</p>
      {info && <p className="muted">{info}</p>}
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" placeholder="vous@exemple.com" required /></label>
      <label>Mot de passe<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
      {error && <p className="ko">{error}</p>}
      <button disabled={busy}>{busy ? "…" : "Se connecter"}</button>
      <p className="muted" style={{ marginTop: 10, textAlign: "center" }}><a href="#" onClick={(e) => { e.preventDefault(); setMode("forgot"); setError(null); setInfo(null); }}>Mot de passe oublié ?</a></p>
      <p className="muted" style={{ marginTop: 4, textAlign: "center" }}>Pas encore de compte ? <a href="#" onClick={(e) => { e.preventDefault(); setMode("signup"); setError(null); setInfo(null); }}>Créer un compte</a></p>
    </form>
  );
}
