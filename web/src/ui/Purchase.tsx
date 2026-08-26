/**
 * Purchase.tsx — écran d'achat d'un cours payant (spec paiement, lot PAY-2).
 * Sélecteur de devise (XOF par défaut, choix mémorisé sur l'appareil), montant
 * affiché depuis le serveur (jamais calculé côté client), puis checkout :
 * page de paiement hébergée (redirection) OU références de virement (manual).
 */
import { useEffect, useState } from "react";
import { api } from "../lib/app";
import type { CourseCatalog } from "../lib/api";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

const CUR_KEY = "klms_currency";
const CUR_LABELS: Record<string, string> = { XOF: "XOF (Afrique de l'Ouest)", XAF: "XAF (Afrique Centrale)", EUR: "EUR" };

export function Purchase({ courseId }: { courseId: string }) {
  const t = useT();
  const [cat, setCat] = useState<CourseCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState<string>(() => {
    try { return localStorage.getItem(CUR_KEY) ?? "XOF"; } catch { return "XOF"; }
  });

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

  function pick(c: string) {
    setCurrency(c);
    try { localStorage.setItem(CUR_KEY, c); } catch { /* stockage indisponible */ }
  }

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
        {offered.length > 1 && (
          <label style={{ display: "block", marginBottom: 10 }}>
            <span className="muted">{t("pay.currency")}</span>
            <select value={active} onChange={(e) => pick(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4 }}>
              {offered.map((c) => <option key={c} value={c}>{CUR_LABELS[c] ?? c}</option>)}
            </select>
          </label>
        )}
        <p style={{ fontSize: 26, fontWeight: 800, margin: "6px 0" }}>{price.display}</p>
        <p className="muted" style={{ marginTop: 0 }}>{t("pay.oneTime")}</p>
        {error && <p className="banner offline">⚠️ {error}</p>}
        <button className="block" disabled={busy} onClick={() => void buy()}>{busy ? t("pay.buying") : t("pay.buy")}</button>
        <button className="block secondary" style={{ marginTop: 8 }} onClick={() => navigate(routes.enrollments())}>{t("pay.back")}</button>
      </article>
    </div>
  );
}
