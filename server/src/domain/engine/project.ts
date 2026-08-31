/**
 * project.ts — Bloc 4 progressive-project helpers (pure).
 *
 * Section 4 of the certification project is NOT typed by the learner: it is
 * auto-composed from the six journal micro-entries once they are all done
 * (« les textes sous format de chapitres rempliront automatiquement le champ »),
 * clamped to the section capacity (750–850 characters).
 */

export type JournalEntryText = { day: number; text: string };

const SECTION4_MAX_CHARS = 850;

/** Compose the Section-4 chapter text: « J+2 : … » per entry, in day order,
 *  proportionally truncated so the whole chapter fits the section capacity. */
export function composeJournalChapter(entries: JournalEntryText[], maxChars = SECTION4_MAX_CHARS): string {
  const ordered = [...entries].sort((a, b) => a.day - b.day).map((e) => ({ ...e, text: e.text.trim() }));
  if (ordered.length === 0) return "";
  const line = (e: JournalEntryText) => `J+${e.day} : ${e.text}`;
  const full = ordered.map(line).join("\n\n");
  if (full.length <= maxChars) return full;
  // Over capacity: share the budget across entries proportionally to their
  // lengths (each keeps at least a small excerpt), ellipsis on the cut.
  const overhead = ordered.reduce((a, e) => a + `J+${e.day} : `.length, 0) + (ordered.length - 1) * 2;
  const budget = Math.max(ordered.length * 20, maxChars - overhead);
  const totalLen = ordered.reduce((a, e) => a + e.text.length, 0) || 1;
  const parts = ordered.map((e) => {
    const share = Math.max(20, Math.floor((e.text.length / totalLen) * budget));
    const cut = e.text.length > share ? `${e.text.slice(0, Math.max(1, share - 1)).trimEnd()}…` : e.text;
    return `J+${e.day} : ${cut}`;
  });
  return parts.join("\n\n").slice(0, maxChars);
}

/** Unlock date of a journal entry: `day` days after the schedule anchor
 *  (the completion of micro-session 4.3). */
export function journalUnlockAt(startedAt: Date, day: number): Date {
  return new Date(startedAt.getTime() + day * 24 * 60 * 60 * 1000);
}

/** Plancher de rédaction d'une section de projet (en MOTS) : en dessous, le
 *  texte n'offre ni matière aux bandes hautes de la grille, ni passage citable
 *  comme preuve (humaine ou automatisée). Miroir de SECTION_MIN_WORDS côté PWA. */
export const PROJECT_SECTION_MIN_WORDS = 30;

/** Nombre de mots d'un texte (toute suite de blancs sépare deux mots). */
export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
