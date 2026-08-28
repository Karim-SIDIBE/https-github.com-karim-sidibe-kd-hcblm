/**
 * vtt.ts — outils WebVTT purs pour l'éditeur de sous-titres (lot STED).
 *
 * Aller-retour fidèle sur les pistes que la plateforme produit (génération
 * Whisper ou import .vtt/.srt converti) : cues « horodatage --> horodatage »
 * suivis d'une ou plusieurs lignes de texte. Les réglages de cue (position,
 * alignement) placés après l'horodatage sont conservés tels quels ; les blocs
 * NOTE/STYLE et les identifiants de cue ne sont pas réécrits (les pistes
 * maison n'en produisent pas).
 */

export type VttCue = {
  /** Secondes (décimales) depuis le début. */
  start: number;
  end: number;
  /** Texte de la cue — plusieurs lignes séparées par \n. */
  text: string;
  /** Réglages VTT après l'horodatage (ex. "align:center"), conservés tels quels. */
  settings?: string;
};

const TIME = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})$/;

/** "hh:mm:ss.mmm" ou "mm:ss.mmm" → secondes ; null si illisible. */
export function parseTimestamp(ts: string): number | null {
  const m = TIME.exec(ts.trim());
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  return h * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/** Secondes → "hh:mm:ss.mmm" (format canonique WebVTT). */
export function formatTimestamp(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = (s % 60).toFixed(3).padStart(6, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${rest}`;
}

/** Parse un document WebVTT en cues. Tolérant : blocs sans « --> » ignorés
 *  (en-tête, NOTE…), virgules SRT acceptées dans les horodatages. */
export function parseVtt(content: string): VttCue[] {
  const cues: VttCue[] = [];
  const blocks = content.replace(/\r/g, "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    const idx = lines.findIndex((l) => l.includes("-->"));
    if (idx === -1) continue; // en-tête WEBVTT, NOTE, STYLE…
    const [left, right] = lines[idx]!.split("-->");
    const start = parseTimestamp(left ?? "");
    const rightParts = (right ?? "").trim().split(/\s+/);
    const end = parseTimestamp(rightParts[0] ?? "");
    if (start === null || end === null) continue;
    const settings = rightParts.slice(1).join(" ") || undefined;
    cues.push({ start, end, text: lines.slice(idx + 1).join("\n"), settings });
  }
  return cues;
}

/** Décale toutes les cues de `offsetSec` (positif = plus tard). Une cue qui
 *  passerait sous zéro est tronquée à 0 (jamais d'horodatage négatif). */
export function shiftCues(cues: VttCue[], offsetSec: number): VttCue[] {
  return cues.map((c) => {
    const start = Math.max(0, c.start + offsetSec);
    // La durée est préservée sauf si le début a été tronqué à 0.
    const end = Math.max(start, c.end + offsetSec);
    return { ...c, start, end };
  });
}

/** Sérialise des cues en document WebVTT canonique. */
export function serializeVtt(cues: VttCue[]): string {
  const body = cues
    .filter((c) => c.text.trim().length > 0)
    .map((c) => `${formatTimestamp(c.start)} --> ${formatTimestamp(c.end)}${c.settings ? ` ${c.settings}` : ""}\n${c.text}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}
