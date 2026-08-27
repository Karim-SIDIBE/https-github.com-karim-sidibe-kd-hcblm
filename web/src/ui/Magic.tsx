/**
 * Magic.tsx — consommation du lien magique reçu par e-mail après un achat
 * invité (PAY-2bis). Le jeton est à usage unique côté serveur : il ouvre une
 * session complète (et marque l'e-mail vérifié), puis on rejoint le catalogue
 * où le parcours acheté est prêt à démarrer.
 */
import { useEffect, useState } from "react";
import { api, setIdentity } from "../lib/app";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

// Un jeton ne doit être POSTé qu'une fois même si l'effet est rejoué
// (StrictMode monte les effets deux fois en dev) — sinon le second appel
// tomberait sur « déjà consommé » et afficherait un faux échec.
const attempted = new Set<string>();

export function Magic({ token, onLogin }: { token: string; onLogin: () => void }) {
  const t = useT();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (attempted.has(token)) return;
    attempted.add(token);
    api.magic(token)
      .then((user) => { setIdentity(user); onLogin(); navigate(routes.enrollments()); })
      .catch(() => setFailed(true));
  }, [token]);

  return (
    <div className="stack">
      <h1>{t("pay.magicTitle")}</h1>
      {failed
        ? (
          <div>
            <p className="banner offline">⚠️ {t("pay.magicFail")}</p>
            <button className="block" onClick={() => navigate(routes.enrollments())}>{t("pay.goLogin")}</button>
          </div>
        )
        : <div><p className="muted">{t("pay.magicWorking")}</p><div className="skeleton card" /></div>}
    </div>
  );
}
