/**
 * competencies.ts — libellés de compétences pour les surfaces APPRENANT.
 *
 * Règle produit (tâche #27) : les codes du référentiel (D1.C1…, S1…) sont un
 * usage interne — tout ce que l'apprenant voit affiche le LIBELLÉ de la
 * compétence. Recette du 06/10/2026 : un parcours importé depuis Word peut
 * porter des intitulés de critères génériques (« Compétence 1 ») et des codes
 * embarqués dans ses textes d'aide — l'affichage les traduit via la liste
 * `content.competencies` du parcours. Fonctions pures, sans I/O.
 */

/** Retire un code du référentiel en tête d'un intitulé (« S1 — … », « D1.C1 : … »). */
export const critLabel = (l: string) => l.replace(/^(?:S\d+|D\d+\.C\d+)\s*[—:-]\s*/, "");

/** Carte code → libellé des compétences du parcours (content.competencies).
 *  Tolérant : contenu partiel ou absent → carte vide, jamais d'exception. */
export function competencyNames(content: unknown): Record<string, string> {
  const list = (content as { competencies?: { code?: unknown; label?: unknown }[] } | null)?.competencies;
  const map: Record<string, string> = {};
  if (Array.isArray(list)) {
    for (const c of list) {
      if (typeof c?.code === "string" && typeof c?.label === "string" && c.label.trim()) map[c.code.trim()] = c.label.trim();
    }
  }
  return map;
}

/** Remplace les codes du référentiel embarqués dans un texte par leurs
 *  libellés. Les codes inconnus de la carte restent tels quels. */
export function humanizeCodes(text: string, names: Record<string, string>): string {
  if (!text || Object.keys(names).length === 0) return text;
  return text.replace(/\bD\d+\.C\d+\b|\bS\d+\b/g, (code) => names[code] ?? code);
}

/** Libellé affiché d'un critère de grille : un intitulé générique d'import
 *  (« Compétence 1 », ou le code lui-même) est remplacé par le libellé du
 *  référentiel du parcours via competencyCode ; sinon l'intitulé est gardé,
 *  codes embarqués traduits. */
export function criterionLabel(c: { label: string; competencyCode?: string }, names: Record<string, string>): string {
  const viaCode = c.competencyCode ? names[c.competencyCode.trim()] : undefined;
  const base = critLabel(c.label).trim();
  if (viaCode && (/^comp[ée]tence\s*\d*$/i.test(base) || /^(?:D\d+\.C\d+|S\d+)$/.test(base))) return viaCode;
  return humanizeCodes(base, names);
}
