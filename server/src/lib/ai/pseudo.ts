/**
 * pseudo.ts — sas de pseudonymisation des appels IA (RGPD art. 4(5) : mesure
 * de réduction du risque, PAS une anonymisation — les textes restent des
 * données personnelles et le régime RGPD continue de s'appliquer).
 *
 * Principe : tout texte qui part vers un fournisseur de modèle passe par
 * `mask()` — les identifiants STRUCTURÉS (courriels, téléphones, URLs, longs
 * numéros) et les identifiants CONNUS (nom de l'apprenant fourni par
 * l'appelant) sont remplacés par des jetons stables ; la table de
 * correspondance ne quitte jamais ce processus, et `reinject()` restitue les
 * valeurs dans la réponse du modèle pour que le texte rendu à l'apprenant
 * reste naturel.
 *
 * Limite assumée (documentée au dossier PI / annexe C du contrat SaaS) : les
 * noms propres ou raisons sociales que l'apprenant écrit librement dans ses
 * textes ne sont pas détectés — une reconnaissance d'entités ajouterait des
 * faux positifs qui dégraderaient la pédagogie. Le nom du titulaire du compte,
 * lui, est toujours masqué (passé en identifiant connu par les appelants).
 */

export type Sas = {
  /** Masque un texte sortant (déterministe au sein du même sas). */
  mask: (text: string) => string;
  /** Restitue les valeurs d'origine dans un texte revenu du modèle. */
  reinject: (text: string) => string;
  /** Nombre d'identifiants distincts masqués (journalisation, tests). */
  count: () => number;
};

// Ordre d'application : URLs d'abord (elles contiennent points et parfois
// courriels), puis courriels, puis numéros. Numéros : international avec
// indicatif (+ puis ≥ 8 chiffres) ou séquence nue d'au moins 10 chiffres —
// en deçà (dates, montants, scores) on ne touche pas.
const URL_RE = /\bhttps?:\/\/[^\s"'<>)\]]+/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+\d(?:[ .\-()]?\d){7,}|(?<!\d)\d(?:[ .\-]?\d){9,}(?!\d)/g;

const LABELS = { url: "lien", email: "courriel", phone: "numero", known: "nom" } as const;
type Kind = keyof typeof LABELS;

export function createSas(knownValues: string[] = []): Sas {
  const tokenToValue = new Map<string, string>();
  const valueToToken = new Map<string, string>();
  const counters: Record<Kind, number> = { url: 0, email: 0, phone: 0, known: 0 };

  const tokenFor = (value: string, kind: Kind): string => {
    const key = `${kind}:${value}`;
    const existing = valueToToken.get(key);
    if (existing) return existing;
    const token = `[[${LABELS[kind]}-${++counters[kind]}]]`;
    valueToToken.set(key, token);
    tokenToValue.set(token, value);
    return token;
  };

  // Identifiants connus (nom du titulaire…) : masqués où qu'ils apparaissent,
  // insensible à la casse, ignorés en deçà de 3 caractères (bruit).
  const known = [...new Set(knownValues.map((v) => v.trim()).filter((v) => v.length >= 3))]
    .sort((a, b) => b.length - a.length); // le plus long d'abord (« Aya Koné » avant « Aya »)

  const mask = (text: string): string => {
    // La ponctuation de fin de phrase collée à l'URL n'en fait pas partie.
    let out = text.replace(URL_RE, (m) => {
      const stripped = m.replace(/[.,;:!?]+$/, "");
      return tokenFor(stripped, "url") + m.slice(stripped.length);
    });
    out = out.replace(EMAIL_RE, (m) => tokenFor(m, "email"));
    out = out.replace(PHONE_RE, (m) => tokenFor(m, "phone"));
    for (const value of known) {
      const re = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      out = out.replace(re, (m) => tokenFor(m.toLowerCase() === value.toLowerCase() ? value : m, "known"));
    }
    return out;
  };

  const reinject = (text: string): string => {
    let out = text;
    for (const [token, value] of tokenToValue) out = out.split(token).join(value);
    return out;
  };

  return { mask, reinject, count: () => tokenToValue.size };
}

/** Masquage sans restitution (vecteurs d'embeddings : rien ne revient). */
export function maskOnce(text: string, knownValues: string[] = []): string {
  return createSas(knownValues).mask(text);
}
