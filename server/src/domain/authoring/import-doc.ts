/**
 * import-doc.ts — pure segmentation of an imported course document.
 *
 * Turns a flat list of paragraphs (text + heading flag) into structure. Two
 * levels, both deterministic and unit-tested:
 *   1. coarse — course title, objective, per-block titles/objectives, and a
 *      per-block bucket of leftover raw text ("à répartir").
 *   2. fine — KD-HCBLM house conventions: "MICRO-SESSION X.Y — …", "Vidéo N — …",
 *      "MESSAGE CLÉ :", "EXEMPLE AFRICAIN :", "ERREUR À ÉVITER :", "(~20 min)".
 *      These fill real micro-session + video fields, no AI.
 * Block detection keys on "Bloc N" (N = 0..4).
 */
export type DocParagraph = { text: string; heading: boolean };

export type ParsedVideo = { title?: string; keyMessage?: string; africanExample?: string; errorToAvoid?: string; durationSec?: number };
export type ParsedSession = { id: string; minor: number; title?: string; durationEstimate?: string; video: ParsedVideo };

export type ImportedDoc = {
  title?: string;
  objective?: string;
  blockTitles: Record<number, string>;
  blockObjectives: Record<number, string>;
  blockSessions: Record<number, ParsedSession[]>;
  /** Per-block leftover raw text (index 0..4), to be dispatched manually. */
  blockNotes: Record<number, string>;
};

const BLOCK_RE = /\bbloc\s*([0-4])\b/i;
const MS_RE = /^micro-?session\s+(\d+)\.(\d+)\b\s*[—–:\-.)]*\s*(.*)$/i;
const VIDEO_RE = /^vid[ée]o\s+\d+\b\s*[—–:\-)]*\s*(.+)$/i;
const KEY_RE = /^message\s+cl[ée]s?\s*[:\-–]\s*(.+)$/i;
const EX_RE = /^exemple\s+africain\s*[:\-–]\s*(.+)$/i;
const ERR_RE = /^erreur\s+[àa]\s+[ée]viter\s*[:\-–]\s*(.+)$/i;
const OBJ_RE = /^objectif(?:\s+global|\s+du\s+parcours)?\s*[:\-–]\s*(.+)$/i;
const DUR_RE = /\(\s*~?\s*(\d+(?:\s*[–-]\s*\d+)?)\s*min[^)]*\)/i;
const TRAIL_DUR_RE = /\s+\d+(?:\s*[–-]\s*\d+)?\s*min\.?\s*$/i;

/** Strip extraction artefacts (bold markers, warning sign, bullets) from a line. */
const clean = (s: string) => s.replace(/^\s*(?:\*\*B\*\*|⚠|[•·*►▪–-])\s*/u, "").trim();

const blockTitleFrom = (text: string) =>
  text.replace(/^\s*bloc\s*[0-4]\s*[—–:\-.)]*\s*/i, "").replace(/\s*\(\s*~?[^)]*\)\s*$/, "").trim();

function durationFrom(text: string): string | undefined {
  const m = DUR_RE.exec(text);
  return m ? `${m[1]!.replace(/\s+/g, "")} min` : undefined;
}

/** Clean a "Vidéo N — « Titre »  5-6 min" line down to its title. */
function videoTitleFrom(rest: string): string {
  return rest.replace(TRAIL_DUR_RE, "").replace(/^[«"'\s]+|[»"'\s]+$/g, "").trim();
}

export function segmentImportedDoc(paras: DocParagraph[]): ImportedDoc {
  const blockTitles: Record<number, string> = {};
  const blockObjectives: Record<number, string> = {};
  const blockSessions: Record<number, ParsedSession[]> = {};
  const intro: string[] = [];
  const buckets: Record<number, string[]> = {};
  let current = -1; // -1 = intro (before any "Bloc N")
  let session: ParsedSession | null = null;

  const noteLine = (idx: number, line: string) => (buckets[idx] ??= []).push(line);

  for (const raw of paras) {
    const t = clean(raw.text);

    // Block boundary.
    const bm = BLOCK_RE.exec(raw.text);
    if (raw.heading && bm) {
      current = Number(bm[1]);
      session = null;
      const title = blockTitleFrom(raw.text);
      if (title && !blockTitles[current]) blockTitles[current] = title;
      continue;
    }

    if (current === -1) { intro.push(raw.text); continue; }

    // Micro-session header → start a new parsed session.
    const msm = MS_RE.exec(t);
    if (msm) {
      const id = `${msm[1]}.${msm[2]}`;
      session = { id, minor: Number(msm[2]), title: msm[3]?.replace(DUR_RE, "").trim() || undefined, durationEstimate: durationFrom(t), video: {} };
      (blockSessions[current] ??= []).push(session);
      continue;
    }

    // Labelled fields (attach to the current session when one is open).
    let m: RegExpExecArray | null;
    if (session && (m = VIDEO_RE.exec(t))) { const title = videoTitleFrom(m[1]!); session.video.title = title; if (!session.title || /^vid[ée]o/i.test(session.title)) session.title = title; continue; }
    if (session && (m = KEY_RE.exec(t))) { session.video.keyMessage = m[1]!.trim(); continue; }
    if (session && (m = EX_RE.exec(t))) { session.video.africanExample = m[1]!.trim(); continue; }
    if (session && (m = ERR_RE.exec(t))) { session.video.errorToAvoid = m[1]!.trim(); continue; }
    if (!session && (m = OBJ_RE.exec(t))) { if (!blockObjectives[current]) blockObjectives[current] = m[1]!.trim(); continue; }

    // Anything else is leftover raw text for manual dispatch.
    noteLine(current, raw.text);
  }

  // Title: first heading in the intro, else first non-empty line.
  const title = paras.find((p) => p.heading && !BLOCK_RE.test(p.text))?.text ?? intro[0];

  // Objective: an "Objectif: …" line in the intro, else first substantial line.
  let objective: string | undefined;
  const consumed: string[] = [];
  for (let i = 0; i < intro.length; i++) {
    const m = OBJ_RE.exec(clean(intro[i]!));
    if (m) { objective = m[1]!.trim(); consumed.push(intro[i]!); break; }
  }
  if (!objective) objective = intro.find((l) => l !== title && l.length > 30);

  const used = new Set([title, objective, ...consumed].filter(Boolean) as string[]);
  const introLeftover = intro.filter((l) => !used.has(l));
  if (introLeftover.length) (buckets[0] ??= []).unshift(...introLeftover);

  const blockNotes: Record<number, string> = {};
  for (const k of Object.keys(buckets)) {
    const idx = Number(k);
    const txt = buckets[idx]!.join("\n").trim();
    if (txt) blockNotes[idx] = txt;
  }

  return { title: title?.trim(), objective: objective?.trim(), blockTitles, blockObjectives, blockSessions, blockNotes };
}
