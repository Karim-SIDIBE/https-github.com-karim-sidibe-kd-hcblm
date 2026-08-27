/**
 * Purchase.tsx — écran d'achat d'un cours payant (spec paiement, PAY-2 + PAY-2bis).
 * Deux modes sur le même écran :
 *  - connecté : catalogue authentifié puis commande classique ;
 *  - invité (PAY-2bis) : E-MAIL SEUL CHAMP — aucun compte à créer avant de
 *    payer. Le numéro mobile n'est jamais demandé ici : il est saisi sur la
 *    page de paiement hébergée de l'agrégateur (Mobile Money).
 * Dans les deux cas le montant vient du serveur (jamais calculé côté client).
 */
import { useEffect, useState } from "react";
import { api, isLoggedIn } from "../lib/app";
import type { CourseCatalog, GuestCourseInfo } from "../lib/api";
import { rememberOrderToken } from "../lib/guestOrder";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

const CUR_KEY = "klms_currency";
const CUR_LABELS: Record<string, string> = { XOF: "XOF (Afrique de l'Ouest)", XAF: "XAF (Afrique Centrale)", EUR: "EUR" };

function useCurrency(): [string, (c: string) => void] {
  const [currency, setCurrency] = useState<string>(() => {
    try { return localStorage.getItem(CUR_KEY) ?? "XOF"; } catch { return "XOF"; }
  });
  const pick = (c: string) => {
    setCurrency(c);
    try { localStorage.setItem(CUR_KEY, c); } catch { /* stockage indisponible */ }
  };
  return [currency, pick];
}

function CurrencyPicker({ offered, active, onPick, label }: { offered: string[]; active: string; onPick: (c: string) => void; label: string }) {
  if (offered.length <= 1) return null;
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span className="muted">{label}</span>
      <select value={active} onChange={(e) => onPick(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4 }}>
        {offered.map((c) => <option key={c} value={c}>{CUR_LABELS[c] ?? c}</option>)}
      </select>
    </label>
  );
}

export function Purchase({ courseId }: { courseId: string }) {
  return isLoggedIn() ? <MemberPurchase courseId={courseId} /> : <GuestPurchase courseId={courseId} />;
}

// --- mode connecté (PAY-2) -------------------------------------------------

function MemberPurchase({ courseId }: { courseId: string }) {
  const t = useT();
  const [cat, setCat] = useState<CourseCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currency, pick] = useCurrency();

  useEffect(() => {
    api.payCatalog(courseId).then(setCat).catch((e) => setError(e instanceof Error ? e.message : t("pay.loadError")));
  }, [courseId]);

  // Déjà titulaire d'un droit (ou cours libre) → retour au catalogue pour s'inscrire.
  useEffect(() => { if (cat && (!cat.paid || cat.entitled)) navigate(routes.enrollments()); }, [cat]);

  if (error) return <div><h1>{t("pay.title")}</h1><p className="banner offline">⚠️ {error}</p></div>;
  if (!cat?.product) return <div><h1>{t("pay.title")}</h1><div className="skeleton card" /></div>;

  const offered = cat.prices.map((p) => p.currency);
  const active = offered.includes(currency) ? currency : offered[0]!;
  const price = cat.prices.find((p) => p.currency === active)!;

  async function buy() {
    setBusy(true); setError(null);
    try {
      const order = await api.payCreateOrder(cat!.product!.id, active);
      const ck = await api.payCheckout(order.id);
      if (ck.paymentUrl) { location.href = ck.paymentUrl; return; } // page hébergée de l'agrégateur
      navigate(routes.order(order.id)); // manual : le suivi affiche les références de virement
    } catch (e) { setError(e instanceof Error ? e.message : t("pay.buyFail")); }
    finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <h1>{t("pay.title")}</h1>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>{cat.product.title}</h2>
        <CurrencyPicker offered={offered} active={active} onPick={pick} label={t("pay.currency")} />
        <p style={{ fontSize: 26, fontWeight: 800, margin: "6px 0" }}>{price.display}</p>
        <p className="muted" style={{ marginTop: 0 }}>{t("pay.oneTime")}</p>
        {error && <p className="banner offline">⚠️ {error}</p>}
        <button className="block" disabled={busy} onClick={() => void buy()}>{busy ? t("pay.buying") : t("pay.buy")}</button>
        <button className="block secondary" style={{ marginTop: 8 }} onClick={() => navigate(routes.enrollments())}>{t("pay.back")}</button>
      </article>
    </div>
  );
}

// --- mode invité (PAY-2bis) : e-mail seul champ ----------------------------

function GuestPurchase({ courseId }: { courseId: string }) {
  const t = useT();
  const [info, setInfo] = useState<GuestCourseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [entitled, setEntitled] = useState(false); // déjà titulaire → lien envoyé
  const [currency, pick] = useCurrency();

  useEffect(() => {
    api.guestCourse(courseId).then(setInfo).catch((e) => setError(e instanceof Error ? e.message : t("pay.loadError")));
  }, [courseId]);

  if (error && !info) return <div><h1>{t("pay.title")}</h1><p className="banner offline">⚠️ {error}</p></div>;
  if (!info) return <div><h1>{t("pay.title")}</h1><div className="skeleton card" /></div>;

  // Cours en accès libre : rien à payer — l'inscription passe par un compte.
  if (!info.paid || !info.product) {
    return (
      <div className="stack">
        <h1>{t("pay.title")}</h1>
        <article className="card">
          <h2 style={{ marginTop: 0 }}>{info.title}</h2>
          <p className="banner">ℹ️ {t("pay.courseFree")}</p>
          <button className="block" onClick={() => navigate(routes.enrollments())}>{t("pay.goLogin")}</button>
        </article>
      </div>
    );
  }

  const offered = info.prices.map((p) => p.currency);
  const active = offered.includes(currency) ? currency : offered[0]!;
  const price = info.prices.find((p) => p.currency === active)!;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function buy() {
    if (!emailOk) { setError(t("pay.emailInvalid")); return; }
    setBusy(true); setError(null);
    try {
      const out = await api.guestCheckout({ courseId, currency: active, email: email.trim() });
      if (out.alreadyEntitled) { setEntitled(true); return; }
      // Jeton de suivi conservé sur l'appareil : la page de retour du paiement
      // (#/order/:id) peut alors suivre la commande sans session.
      rememberOrderToken(out.orderId, out.orderToken);
      if (out.paymentUrl) { location.href = out.paymentUrl; return; } // page hébergée de l'agrégateur
      navigate(routes.order(out.orderId)); // manual : références de virement sur le suivi
    } catch (e) { setError(e instanceof Error ? e.message : t("pay.buyFail")); }
    finally { setBusy(false); }
  }

  if (entitled) {
    return (
      <div className="stack">
        <h1>{t("pay.title")}</h1>
        <article className="card">
          <h2 style={{ marginTop: 0 }}>{info.product.title}</h2>
          <p className="banner" style={{ background: "var(--ok-bg, #E7F4EA)" }}>✅ {t("pay.alreadyEntitled")}</p>
          <button className="block" onClick={() => navigate(routes.enrollments())}>{t("pay.goLogin")}</button>
        </article>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>{t("pay.title")}</h1>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>{info.product.title}</h2>
        <CurrencyPicker offered={offered} active={active} onPick={pick} label={t("pay.currency")} />
        <p style={{ fontSize: 26, fontWeight: 800, margin: "6px 0" }}>{price.display}</p>
        <p className="muted" style={{ marginTop: 0 }}>{t("pay.oneTime")}</p>
        <label style={{ display: "block", margin: "10px 0" }}>
          <span className="muted">{t("pay.guestEmail")}</span>
          <input
            type="email" inputMode="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
        <p className="muted" style={{ marginTop: 0 }}>{t("pay.guestEmailHint")}</p>
        <p className="muted" style={{ marginTop: 0 }}>{t("pay.guestPhoneNote")}</p>
        {error && <p className="banner offline">⚠️ {error}</p>}
        <button className="block" disabled={busy || !emailOk} onClick={() => void buy()}>{busy ? t("pay.buying") : t("pay.buy")}</button>
        <button className="block secondary" style={{ marginTop: 8 }} onClick={() => navigate(routes.enrollments())}>{t("pay.goLogin")}</button>
      </article>
    </div>
  );
}
