import { useEffect, useMemo, useState } from "react";
import { UI_TEXT_DEFAULTS, type UiLang } from "@kd/shared/ui-texts";
import { api } from "../lib/api";

/**
 * UiTexts — « Textes de l'interface » (SUPER_ADMIN).
 *
 * Every FR/EN text of the learner app, editable one by one. Defaults come from
 * @kd/shared/ui-texts (the same data the app renders); only overrides are
 * stored server-side (UiText). « Rétablir » reverts to the original text.
 * Learners get the change at their next app load (overrides are fetched at
 * boot and cached for offline).
 */

const GROUPS: Record<string, string> = {
  nav: "Navigation", brand: "Marque", banner: "Bandeaux", common: "Commun", ph: "Champs",
  login: "Connexion", signup: "Inscription", verify: "Vérification e-mail", forgot: "Mot de passe oublié",
  reset: "Nouveau mot de passe", install: "Installation PWA", level: "Niveaux", enr: "Mes parcours",
  home: "Accueil", course: "Écran Cours", ob: "Introduction (Bloc 0)", sess: "Micro-session",
  quiz: "Quiz (questions)", qz: "Quiz (écrans)", ex: "Micro-exercice", act: "Activités longues",
  dl: "Livrables", jr: "Journal", pj: "Projet (Bloc 4)", bd: "Badges", badge: "Célébration badge",
  ci: "Éléments de parcours", rev: "Révision", acct: "Mon compte", a11y: "Accessibilité", mission: "Mission",
};
const groupOf = (key: string) => key.includes(".") ? key.slice(0, key.indexOf(".")) : key;

const field: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--line-strong)", borderRadius: 8, fontFamily: "inherit", fontSize: 13, resize: "vertical" };

export function UiTexts() {
  const [locale, setLocale] = useState<UiLang>("fr");
  const [overrides, setOverrides] = useState<Record<UiLang, Record<string, string>>>({ fr: {}, en: {} });
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // key → texte en cours d'édition (langue courante)
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.uiTexts().then((o) => { setOverrides({ fr: o.fr ?? {}, en: o.en ?? {} }); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);
  useEffect(() => { setDrafts({}); setErrors({}); }, [locale]);

  const defaults = UI_TEXT_DEFAULTS[locale];
  const keys = useMemo(() => Object.keys(defaults), [defaults]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return keys;
    return keys.filter((k) => k.toLowerCase().includes(needle)
      || defaults[k]!.toLowerCase().includes(needle)
      || (overrides[locale][k] ?? "").toLowerCase().includes(needle));
  }, [keys, q, defaults, overrides, locale]);

  const grouped = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const k of filtered) { const g = groupOf(k); (m.get(g) ?? m.set(g, []).get(g)!).push(k); }
    return [...m.entries()];
  }, [filtered]);

  const currentValue = (k: string) => drafts[k] ?? overrides[locale][k] ?? defaults[k]!;
  const isOverridden = (k: string) => overrides[locale][k] !== undefined;
  const isDirty = (k: string) => drafts[k] !== undefined && drafts[k] !== (overrides[locale][k] ?? defaults[k]);

  async function save(k: string) {
    setBusy((b) => ({ ...b, [k]: true })); setErrors((e) => ({ ...e, [k]: "" }));
    try {
      await api.setUiText(locale, k, drafts[k]!);
      setOverrides((o) => ({ ...o, [locale]: { ...o[locale], [k]: drafts[k]!.trim() } }));
      setDrafts((d) => { const { [k]: _, ...rest } = d; return rest; });
    } catch (e: any) { setErrors((er) => ({ ...er, [k]: e?.message || "Erreur" })); }
    finally { setBusy((b) => ({ ...b, [k]: false })); }
  }
  async function revert(k: string) {
    setBusy((b) => ({ ...b, [k]: true })); setErrors((e) => ({ ...e, [k]: "" }));
    try {
      await api.resetUiText(locale, k);
      setOverrides((o) => { const { [k]: _, ...rest } = o[locale]; return { ...o, [locale]: rest }; });
      setDrafts((d) => { const { [k]: _, ...rest } = d; return rest; });
    } catch (e: any) { setErrors((er) => ({ ...er, [k]: e?.message || "Erreur" })); }
    finally { setBusy((b) => ({ ...b, [k]: false })); }
  }

  const overriddenCount = Object.keys(overrides[locale]).length;

  return (
    <div className="content">
      <div className="card">
        <div className="card-h">
          <b>Textes de l'interface apprenant</b>
          <span className="muted" style={{ fontSize: 12.5 }}>{keys.length} textes · {overriddenCount} personnalisé(s) ({locale.toUpperCase()})</span>
        </div>
        <div className="card-b">
          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <div className="row" style={{ gap: 6 }}>
              {(["fr", "en"] as const).map((l) => (
                <button key={l} className={`btn ${locale === l ? "" : "ghost"}`} onClick={() => setLocale(l)}>{l === "fr" ? "🇫🇷 Français" : "🇬🇧 English"}</button>
              ))}
            </div>
            <input style={{ ...field, maxWidth: 360, resize: "none" }} placeholder="Rechercher un texte ou une clé…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
            Modifiez un texte puis « Enregistrer » — il s'applique à tous les apprenants au prochain chargement de l'application.
            Les mots entre accolades (ex. <code>{"{name}"}</code>) sont remplacés automatiquement et doivent être conservés.
            « Rétablir » revient au texte d'origine.
          </p>
        </div>
      </div>

      {!loaded && <div className="card"><div className="card-b">Chargement…</div></div>}
      {loaded && grouped.length === 0 && <div className="card"><div className="card-b muted">Aucun texte ne correspond à « {q} ».</div></div>}

      {grouped.map(([g, ks]) => (
        <div className="card" key={g}>
          <div className="card-h"><b>{GROUPS[g] ?? g}</b><span className="muted" style={{ fontSize: 12 }}>{ks.length} texte(s)</span></div>
          <div className="card-b" style={{ display: "grid", gap: 14 }}>
            {ks.map((k) => {
              const long = defaults[k]!.length > 70;
              return (
                <div key={k} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
                  <div className="row between" style={{ marginBottom: 5, gap: 8, flexWrap: "wrap" }}>
                    <code className="muted" style={{ fontSize: 11.5 }}>{k}</code>
                    <span className="row" style={{ gap: 6 }}>
                      {isOverridden(k) && <span className="pill" style={{ background: "var(--orange-50)", color: "var(--orange-600, #c2570f)", fontSize: 11 }}>personnalisé</span>}
                      {isOverridden(k) && <button className="btn ghost" style={{ fontSize: 12, padding: "3px 9px" }} disabled={busy[k]} onClick={() => revert(k)}>↩ Rétablir</button>}
                      <button className="btn" style={{ fontSize: 12, padding: "3px 9px" }} disabled={!isDirty(k) || busy[k]} onClick={() => save(k)}>{busy[k] ? "…" : "Enregistrer"}</button>
                    </span>
                  </div>
                  {long
                    ? <textarea style={{ ...field, minHeight: 58 }} value={currentValue(k)} onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))} />
                    : <input style={field} value={currentValue(k)} onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))} />}
                  {isOverridden(k) && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Texte d'origine : {defaults[k]}</div>}
                  {errors[k] && <div style={{ color: "var(--danger, #c0392b)", fontSize: 12, marginTop: 4 }}>⚠ {errors[k]}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
