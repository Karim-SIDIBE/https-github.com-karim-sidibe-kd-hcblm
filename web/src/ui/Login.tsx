import { useState } from "react";
import { api, setIdentity } from "../lib/app";
import { brand } from "../lib/brand";
import { useT } from "../lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

type Mode = "login" | "signup" | "verify" | "forgot" | "reset";

export function Login({ onLogin }: { onLogin: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — must stay empty
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = (u: { id: string; name: string; email: string }) => { setIdentity({ id: u.id, name: u.name, email: u.email }); onLogin(); };

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { done(await api.login(email, password)); }
    catch (err: any) {
      if (err?.code === "email_unverified") { setMode("verify"); setInfo(t("login.unverified")); setError(null); }
      else setError(err?.message || t("login.invalid"));
    } finally { setBusy(false); }
  }

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptTerms) { setError(t("signup.mustAccept")); return; }
    setBusy(true); setError(null);
    try {
      await api.register({ name: name.trim(), email: email.trim(), password, phone: phone.trim() || undefined, acceptTerms, marketingOptIn, ...(website ? { website } as any : {}) });
      setMode("verify"); setInfo(t("signup.codeSent", { email }));
    } catch (err: any) { setError(err?.message || t("signup.fail")); }
    finally { setBusy(false); }
  }

  async function submitVerify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { done(await api.verify(email.trim(), code.trim())); }
    catch (err: any) { setError(err?.message || t("verify.invalid")); }
    finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setError(null);
    try { await api.resendVerification(email.trim()); setInfo(t("verify.resent")); }
    finally { setBusy(false); }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api.forgotPassword(email.trim()); setMode("reset"); setInfo(t("forgot.sent", { email })); setPassword(""); }
    finally { setBusy(false); }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { done(await api.resetPassword(email.trim(), code.trim(), password)); }
    catch (err: any) { setError(err?.message || t("reset.fail")); }
    finally { setBusy(false); }
  }

  const card: React.CSSProperties = { maxWidth: 360, margin: "60px auto" };
  const langRow = <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}><LanguageSwitcher /></div>;

  if (mode === "signup") {
    return (
      <form className="card" onSubmit={submitSignup} style={card}>
        {langRow}
        <h1>{brand.name}</h1>
        <p className="muted">{t("signup.subtitle", { operator: brand.operator })}</p>
        <label>{t("signup.fullName")}<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
        <label>{t("login.email")}<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder={t("ph.email")} required /></label>
        <label>{t("signup.phone")} <span className="muted">{t("common.optional")}</span><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="+225 07 00 00 00 00" /></label>
        <label>{t("login.password")}<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={10} placeholder={t("signup.passwordMin")} required /></label>
        {/* honeypot: hidden from users, tab-skipped */}
        <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} />
        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, fontWeight: 400, cursor: "pointer" }}>
          <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} style={{ width: "auto", marginTop: 3 }} />
          <span>{t("signup.acceptPre")}<a href="/legal/cgu" target="_blank" rel="noreferrer">{t("signup.terms")}</a>{t("signup.and")}<a href="/legal/confidentialite" target="_blank" rel="noreferrer">{t("signup.privacy")}</a>. <span style={{ color: "var(--ko, #c0392b)" }}>*</span></span>
        </label>
        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, fontWeight: 400, cursor: "pointer" }}>
          <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} style={{ width: "auto", marginTop: 3 }} />
          <span>{t("signup.marketing")} <span className="muted">{t("common.optional")}</span>.</span>
        </label>
        {error && <p className="ko">{error}</p>}
        <button disabled={busy || !acceptTerms}>{busy ? "…" : t("signup.create")}</button>
        <p className="muted" style={{ marginTop: 12, textAlign: "center" }}>{t("signup.already")} <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(null); setInfo(null); }}>{t("login.signIn")}</a></p>
      </form>
    );
  }

  if (mode === "verify") {
    return (
      <form className="card" onSubmit={submitVerify} style={card}>
        {langRow}
        <h1>{t("verify.title")}</h1>
        {info && <p className="muted">{info}</p>}
        <label>{t("login.email")}<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
        <label>{t("verify.code")}<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder={t("verify.codePh")} required /></label>
        {error && <p className="ko">{error}</p>}
        <button disabled={busy}>{busy ? "…" : t("verify.submit")}</button>
        <p className="muted" style={{ marginTop: 12, textAlign: "center" }}>
          <a href="#" onClick={(e) => { e.preventDefault(); void resend(); }}>{t("verify.resend")}</a> · <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(null); setInfo(null); }}>{t("common.back")}</a>
        </p>
      </form>
    );
  }

  if (mode === "forgot") {
    return (
      <form className="card" onSubmit={submitForgot} style={card}>
        {langRow}
        <h1>{t("forgot.title")}</h1>
        <p className="muted">{t("forgot.intro")}</p>
        <label>{t("login.email")}<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
        {error && <p className="ko">{error}</p>}
        <button disabled={busy}>{busy ? "…" : t("forgot.send")}</button>
        <p className="muted" style={{ marginTop: 12, textAlign: "center" }}><a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(null); setInfo(null); }}>{t("common.back")}</a></p>
      </form>
    );
  }

  if (mode === "reset") {
    return (
      <form className="card" onSubmit={submitReset} style={card}>
        {langRow}
        <h1>{t("reset.title")}</h1>
        {info && <p className="muted">{info}</p>}
        <label>{t("login.email")}<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
        <label>{t("reset.codeReceived")}<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder={t("verify.codePh")} required /></label>
        <label>{t("reset.title")}<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={10} placeholder={t("signup.passwordMin")} required /></label>
        {error && <p className="ko">{error}</p>}
        <button disabled={busy}>{busy ? "…" : t("reset.submit")}</button>
        <p className="muted" style={{ marginTop: 12, textAlign: "center" }}><a href="#" onClick={(e) => { e.preventDefault(); void api.forgotPassword(email.trim()); setInfo(t("reset.resent")); }}>{t("verify.resend")}</a> · <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(null); setInfo(null); }}>{t("common.back")}</a></p>
      </form>
    );
  }

  return (
    <form className="card" onSubmit={submitLogin} style={card}>
      {langRow}
      <h1>{brand.name}</h1>
      <p className="muted">{t("login.subtitle", { operator: brand.operator })}</p>
      {info && <p className="muted">{info}</p>}
      <label>{t("login.email")}<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" placeholder={t("ph.email")} required /></label>
      <label>{t("login.password")}<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
      {error && <p className="ko">{error}</p>}
      <button disabled={busy}>{busy ? "…" : t("login.signIn")}</button>
      <p className="muted" style={{ marginTop: 10, textAlign: "center" }}><a href="#" onClick={(e) => { e.preventDefault(); setMode("forgot"); setError(null); setInfo(null); }}>{t("login.forgot")}</a></p>
      <p className="muted" style={{ marginTop: 4, textAlign: "center" }}>{t("login.noAccount")} <a href="#" onClick={(e) => { e.preventDefault(); setMode("signup"); setError(null); setInfo(null); }}>{t("login.create")}</a></p>
    </form>
  );
}
