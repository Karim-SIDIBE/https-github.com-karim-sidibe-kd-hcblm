import { useT } from "../lib/i18n";
import { navigate, routes } from "../lib/router";

/** Écran « Comment cette formation fonctionne » (arbitrage A5) — extrait de
 *  l'onboarding pour servir deux usages (06/10/2026) : la première entrée dans
 *  le Bloc 0 (CTA « je commence ») ET la relecture permanente depuis la page
 *  du cours (CTA « retour au cours »). */
export function HowItWorks({ ctaLabel, onCta }: { ctaLabel: string; onCta: () => void }) {
  const t = useT();
  return (
    <div className="hf-card stack">
      <h1>{t("ob.howTitle")}</h1>
      <p className="body" style={{ margin: 0 }}>{t("ob.howIntro")}</p>
      {(["ob.how1", "ob.how2", "ob.how3", "ob.how4", "ob.how5"] as const).map((k) => (
        <div key={k} className="hf-card hf-card--icy" style={{ padding: "10px 14px" }}>
          <p className="body" style={{ margin: 0 }}>{t(k)}</p>
        </div>
      ))}
      <button className="hf-btn hf-btn--primary hf-btn--block" onClick={onCta}>{ctaLabel}</button>
    </div>
  );
}

/** Page de consultation : la méthode reste lisible à tout moment du parcours. */
export function Method({ eid }: { eid: string }) {
  const t = useT();
  const back = () => navigate(routes.course(eid));
  return (
    <div className="stack">
      <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0, alignSelf: "flex-start" }} onClick={back}>← {t("nav.home")}</button>
      <HowItWorks ctaLabel={t("mt.back")} onCta={back} />
    </div>
  );
}
