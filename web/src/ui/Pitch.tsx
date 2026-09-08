/**
 * Pitch.tsx — argumentaire pédagogique d'avant-achat (positionnement du
 * parcours). Affiché sous « Acheter » sur la carte catalogue (connecté) ET sur
 * l'écran d'achat invité (PAY-2bis/2ter), qui est la page d'atterrissage du
 * trafic venu du site vitrine. Textes surchargables via l'admin (clés pitch.*).
 */
import { useT } from "../lib/i18n";

export function PitchSection() {
  const t = useT();
  return (
    <div className="pitch">
      <section>
        <h4>{t("pitch.title")}</h4>
        <p className="pitch-from"><b>{t("pitch.beforeLabel")}</b>{t("pitch.before")}</p>
        <p className="pitch-to"><b>{t("pitch.afterLabel")}</b>{t("pitch.after")}</p>
      </section>
      <section>
        <h4>{t("pitch.forTitle")}</h4>
        <ul className="pitch-checks">{[1, 2, 3, 4].map((i) => <li key={i}>{t(`pitch.for${i}`)}</li>)}</ul>
      </section>
      <section>
        <h4>{t("pitch.getTitle")}</h4>
        <ul className="pitch-checks">{[1, 2, 3, 4, 5].map((i) => <li key={i}>{t(`pitch.get${i}`)}</li>)}</ul>
      </section>
      <section>
        <h4>{t("pitch.skillsTitle")}</h4>
        <div className="pitch-skills">{[1, 2, 3, 4].map((i) => <span key={i} className="pitch-skill">{t(`pitch.skill${i}`)}</span>)}</div>
      </section>
    </div>
  );
}
