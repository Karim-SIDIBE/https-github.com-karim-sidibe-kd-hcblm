/**
 * competencies.ts — libellés de compétences pour les surfaces UTILISATEURS.
 *
 * Règle produit : les codes du référentiel (D1.C1…) sont un usage INTERNE
 * (console d'administration, échanges SIRH, Open Badges `targetCode`, fiche
 * d'évaluation FACE2FACE — objet D). Tout ce qu'un apprenant, un client ou un
 * vérificateur de certificat voit affiche le LIBELLÉ de la compétence
 * (« Clarté et structuration du message »…), jamais le code seul.
 */

/** Extrait les libellés de compétences d'un contenu de cours (tolérant :
 *  contenu partiel ou absent → liste vide, jamais d'exception). */
export function competencyLabels(content: unknown): string[] {
  const list = (content as { competencies?: { label?: unknown }[] } | null)?.competencies;
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const c of list) {
    const label = typeof c?.label === "string" ? c.label.trim() : "";
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}
