/**
 * composition.ts — signaux de composition des champs certifiants.
 *
 * Avenant n°1 au Socle commun d'évaluation certifiante (objet F) et son annexe
 * technique. Le dispositif COMPARE LE CANDIDAT À LUI-MÊME, jamais à un modèle :
 * il n'emploie aucun détecteur de contenu généré, n'analyse jamais le texte, et
 * ne conserve que des AGRÉGATS écrits une seule fois à la soumission du champ
 * (annexe §5 : « aucune écriture en continu pendant la saisie »).
 *
 * Période d'observation (F.9 / annexe §8, étape 1) : capture des quatre
 * indicateurs SANS calcul de signal, SANS restitution, SANS seuil — `signal`
 * reste NULL tant que la calibration (ruptures observées dans la distribution
 * réelle, mobile et ordinateur distingués) n'a pas eu lieu.
 *
 * Cloisonnement (annexe §7) : ces données ne sont JAMAIS exposées à
 * l'évaluateur, à aucun moment, y compris après la décision — condition de
 * validité de la double notation (§9.3) et du recours (§10).
 */
import { z } from "zod";

/** Champs instrumentés (annexe §1) — identifiants fonctionnels. */
export const FIELD_ANCRAGE = "bloc0.ancrage";
export const FIELD_ECART_ANCRAGE = "bloc4.ecart_ancrage";
export const journalFieldKey = (day: number) => `bloc4.journal.J+${day}`;
/** Sections du dossier du Bloc 4, par index de section (0-based). La section 4
 *  (journal auto-composée) n'est pas saisissable, donc pas instrumentée. */
export const SECTION_FIELD_KEYS: Record<number, string> = {
  0: "bloc4.situation",
  1: "bloc4.solution",
  2: "bloc4.resultat",
  4: "bloc4.apprentissage",
};

/** Identifiant fonctionnel d'une section à partir de sa clé d'item — la
 *  Section 1 porte la clé historique « project » (sans suffixe). */
export function sectionFieldKey(itemKey: string): string | null {
  const idx = itemKey === "project" ? 0 : Number(/^project@(\d+)$/.exec(itemKey)?.[1] ?? NaN);
  return Number.isFinite(idx) ? SECTION_FIELD_KEYS[idx] ?? null : null;
}

/** Agrégats captés côté client (annexe §2) — rien qui permette de reconstituer
 *  le texte : pas de séquence de caractères, pas de contenu, pas de presse-
 *  papiers. Les origines d'insertion suivent l'annexe §4 : la saisie gestuelle,
 *  prédictive et la dictée comptent comme COMPOSITION ; seul le collage
 *  explicite compte comme DÉPÔT (le faux négatif est préférable au faux
 *  positif). */
export const CompositionCapture = z.object({
  device: z.enum(["mobile", "desktop"]),
  firstInputAt: z.coerce.date(),
  charsTotal: z.number().int().min(0),
  charsComposed: z.number().int().min(0),
  charsPasted: z.number().int().min(0),
  deleteEvents: z.number().int().min(0),
  retouchesAfterPaste: z.number().int().min(0),
  sessions: z.number().int().min(1),
});
export type CompositionCaptureT = z.infer<typeof CompositionCapture>;

export type CompositionIndicators = {
  depositRate: number;
  retouchRate: number | null;
  density: number;
  spread: number | null;
};

/** Fenêtre d'ouverture d'une micro-entrée de journal (pour l'étalement). */
export type JournalWindow = { opensAt: Date; widthMs: number };

/** Les quatre indicateurs de l'annexe §3, calculés à la soumission.
 *  - Taux de dépôt : caractères collés / total du champ à la soumission.
 *  - Taux de retouche après dépôt : retouches postérieures au dernier collage /
 *    caractères collés (null sans collage).
 *  - Densité temporelle : caractères / minute entre la première saisie et la
 *    soumission.
 *  - Étalement : (soumission − ouverture de la fenêtre) / largeur de la
 *    fenêtre — micro-entrées du journal uniquement. */
export function computeIndicators(
  c: CompositionCaptureT, submittedAt: Date, journalWindow?: JournalWindow,
): CompositionIndicators {
  const total = Math.max(1, c.charsTotal);
  const minutes = Math.max((submittedAt.getTime() - c.firstInputAt.getTime()) / 60_000, 1 / 60);
  return {
    depositRate: Math.min(1, c.charsPasted / total),
    retouchRate: c.charsPasted > 0 ? c.retouchesAfterPaste / c.charsPasted : null,
    density: c.charsTotal / minutes,
    spread: journalWindow
      ? Math.max(0, (submittedAt.getTime() - journalWindow.opensAt.getTime()) / Math.max(1, journalWindow.widthMs))
      : null,
  };
}

/** Fenêtres des micro-entrées : de l'ouverture (J+jour) à l'ouverture de la
 *  suivante ; la dernière entrée reprend la largeur de l'intervalle précédent
 *  (choix documenté — l'annexe fixe le principe, pas la borne de fin). */
export function journalWindows(journalStartedAt: Date, days: number[]): Map<number, JournalWindow> {
  const sorted = [...days].sort((a, b) => a - b);
  const out = new Map<number, JournalWindow>();
  const DAY = 86_400_000;
  sorted.forEach((day, i) => {
    const next = sorted[i + 1];
    const prev = sorted[i - 1];
    const widthDays = next != null ? next - day : prev != null ? day - prev : 1;
    out.set(day, { opensAt: new Date(journalStartedAt.getTime() + day * DAY), widthMs: widthDays * DAY });
  });
  return out;
}
