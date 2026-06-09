/**
 * import-doc.ts — pure segmentation of an imported course document.
 *
 * Turns a flat list of paragraphs (text + heading flag) into a coarse,
 * deterministic structure: course title, objective, and a per-block bucket of
 * raw text the designer can dispatch into the right fields. No AI, no I/O —
 * fully unit-tested. Block detection keys on "Bloc N" headings (N = 0..4),
 * matching the KD-HCBLM 5-block skeleton.
 */
export type DocParagraph = { text: string; heading: boolean };

export type ImportedDoc = {
  title?: string;
  objective?: string;
  /** Per-block raw text (index 0..4), to be dispatched manually. */
  blockTitles: Record<number, string>;
  blockNotes: Record<number, string>;
};

const BLOCK_RE = /\bbloc\s*([0-4])\b/i;
const OBJECTIVE_RE = /^\s*(objectif|objectifs|but du parcours)\b\s*:?\s*(.*)$/i;

/** Strip a leading "Bloc N — " / "Bloc N :" prefix to get a clean block title. */
function blockTitleFrom(text: string): string {
  return text.replace(/^\s*bloc\s*[0-4]\s*[—–:\-.)]*\s*/i, "").trim();
}

export function segmentImportedDoc(paras: DocParagraph[]): ImportedDoc {
  const blockTitles: Record<number, string> = {};
  const intro: string[] = [];
  const buckets: Record<number, string[]> = {};
  let current = -1; // -1 = intro (before any "Bloc N")

  for (const p of paras) {
    const bm = BLOCK_RE.exec(p.text);
    if (p.heading && bm) {
      current = Number(bm[1]);
      const t = blockTitleFrom(p.text);
      if (t && !blockTitles[current]) blockTitles[current] = t;
      continue; // the heading itself isn't body text
    }
    (current === -1 ? intro : (buckets[current] ??= [])).push(p.text);
  }

  // Title: first heading in the intro, else first non-empty line.
  const title = paras.find((p) => p.heading && !BLOCK_RE.test(p.text))?.text ?? intro[0];

  // Objective: an "Objectif: …" line anywhere, else the line after such a label,
  // else the first substantial intro paragraph that isn't the title.
  let objective: string | undefined;
  const consumed: string[] = []; // intro lines already turned into title/objective
  for (let i = 0; i < intro.length; i++) {
    const m = OBJECTIVE_RE.exec(intro[i]!);
    if (m) {
      const inline = m[2] && m[2].length > 3;
      objective = (inline ? m[2] : intro[i + 1]) || undefined;
      consumed.push(intro[i]!);            // the label line itself
      if (!inline && intro[i + 1]) consumed.push(intro[i + 1]!); // the value line
      break;
    }
  }
  if (!objective) objective = intro.find((l) => l !== title && l.length > 30);

  // Whatever intro text is left (minus title/objective) shouldn't be lost:
  // park it in block 0 so the designer still sees it.
  const used = new Set([title, objective, ...consumed].filter(Boolean) as string[]);
  const introLeftover = intro.filter((l) => !used.has(l));
  if (introLeftover.length) (buckets[0] ??= []).unshift(...introLeftover);

  const blockNotes: Record<number, string> = {};
  for (const k of Object.keys(buckets)) {
    const idx = Number(k);
    const txt = buckets[idx]!.join("\n").trim();
    if (txt) blockNotes[idx] = txt;
  }

  return { title: title?.trim(), objective: objective?.trim(), blockTitles, blockNotes };
}
