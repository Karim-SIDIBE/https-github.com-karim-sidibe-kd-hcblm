/**
 * GuestCatalog.tsx — catalogue PUBLIC des parcours (PAY-2ter).
 *
 * Page d'atterrissage sans compte : le site vitrine (declick.digital) pointe
 * ici (ou directement sur #/buy/<slug>) pour présenter l'offre avec option
 * d'achat AVANT toute création de compte — le compte naît après le paiement
 * (tunnel invité PAY-2bis, e-mail seul champ, connexion par lien magique).
 */
import { useEffect, useState } from "react";
import { api } from "../lib/app";
import type { GuestCatalogItem } from "../lib/api";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

export function GuestCatalog() {
  const t = useT();
  const levelLabel = (l: string) => { const n = l.replace(/\D/g, ""); return n === "1" || n === "2" || n === "3" ? t(`level.${n}`) : l; };
  const [list, setList] = useState<GuestCatalogItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    setFailed(false);
    try { setList(await api.guestCatalog()); } catch { setFailed(true); }
  }
  useEffect(() => { void load(); }, []);

  if (failed) {
    return (
      <div>
        <h1>{t("gc.title")}</h1>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="muted" style={{ margin: "0 0 10px" }}>⚠️ {t("enr.catalogError")}</p>
          <button className="block secondary" onClick={() => void load()}>{t("enr.retry")}</button>
        </div>
      </div>
    );
  }
  if (!list) return <div><h1>{t("gc.title")}</h1><div className="skeleton card" /></div>;

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>{t("gc.title")}</h1>
        <p className="muted" style={{ marginTop: 0 }}>{t("gc.intro")}</p>
      </div>
      {list.length === 0 && <p className="muted">{t("gc.empty")}</p>}
      {list.map((c) => (
        <article key={c.courseId} className="card">
          <div className="row between">
            <h3 style={{ margin: 0 }}>{c.title}</h3>
            <span className="chip">{levelLabel(c.level)}</span>
          </div>
          {c.paid && c.prices[0] && <p className="muted" style={{ margin: "6px 0 0" }}>💳 {c.prices[0].display}</p>}
          {c.paid
            ? <button className="block" style={{ marginTop: 10 }} onClick={() => navigate(routes.purchase(c.slug || c.courseId))}>{t("pay.buy")}</button>
            : (
              <>
                <p className="muted" style={{ margin: "6px 0 0" }}>{t("gc.freeNote")}</p>
                <button className="block secondary" style={{ marginTop: 10 }} onClick={() => navigate(routes.enrollments())}>{t("login.signIn")}</button>
              </>
            )}
        </article>
      ))}
      <p className="muted" style={{ textAlign: "center" }}>
        {t("gc.haveAccount")} <a href="#" onClick={(e) => { e.preventDefault(); navigate(routes.enrollments()); }}>{t("login.signIn")}</a>
      </p>
    </div>
  );
}
