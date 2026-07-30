/**
 * textcheck.ts — plausibility gate for free-text answers (consigne
 * « Amélioration » — 3e point). Pure + offline (no dictionary download):
 * flags answers whose "words" cannot be French or English (keyboard mash,
 * vowel-less runs, impossible letter clusters), and fields that expect a
 * number but received none. The validate buttons stay blocked with the
 * REASON displayed until the answer is fixed.
 *
 * Design bias: NEVER block legitimate prose — African proper nouns (Nkrumah,
 * Mbeki, N'Djamena…), abbreviations and numbers must pass. A word is only
 * "implausible" on hard signals, and a text is only blocked when implausible
 * words dominate it.
 */

export type TextAssessment =
  | { ok: true }
  | { ok: false; code: "gibberish"; words: string[] }
  | { ok: false; code: "too_short"; minWords: number }
  | { ok: false; code: "need_number" };

const VOWELS = "aeiouyàâäéèêëîïôöùûüœ";
// Letter pairs that occur in no French/English word (kept SHORT on purpose —
// each entry must be impossible, not just rare, so names survive).
const IMPOSSIBLE_BIGRAMS = ["fh", "jq", "qk", "qz", "vq", "wq", "xj", "zx", "qq", "vj", "wv", "fq", "pq", "bq"];
const MASH_SEQUENCES = ["azert", "qwert", "asdf", "qsdf", "wxcv", "zxcv", "uiop", "hjkl"];
// Legal 4-consonant clusters (across syllables): « instruction », « lymphe »…
const LEGAL_CLUSTERS = ["str", "ntr", "mpt", "nch", "sch", "rch", "phr", "thr", "chr", "mbr", "ndr", "ngl", "mpl", "nst", "rst", "bst", "xpl", "xtr", "ngt", "ght", "rthw"];

const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Hard-signal implausibility of one token (letters only, length ≥ 3). */
export function isImplausibleWord(raw: string): boolean {
  const w = raw.toLowerCase();
  const plain = norm(raw);
  if (/\d/.test(w)) return false; // numeric-ish tokens are handled elsewhere
  const letters = plain.replace(/[^a-z]/g, "");
  if (letters.length < 4) return false; // short tokens: never judged
  // Same letter 3+ times in a row ("aaah" tolerated at 3? no: "elll" is not a word).
  if (/(.)\1\1/.test(letters)) return true;
  // Keyboard mash.
  if (MASH_SEQUENCES.some((m) => letters.includes(m))) return true;
  // Impossible letter pairs.
  if (IMPOSSIBLE_BIGRAMS.some((b) => letters.includes(b))) return true;
  // Vowel balance: a 4+ letter word with no vowel at all, or almost only vowels.
  const v = [...letters].filter((c) => VOWELS.includes(c)).length;
  if (v === 0) return true;
  if (letters.length >= 5 && v / letters.length > 0.85) return true;
  // Consonant runs: 5+ is never legal; 4 only inside known clusters. Plural
  // "s" is stripped first so English words like "strengths" stay legal.
  const stem = letters.length > 4 && letters.endsWith("s") ? letters.slice(0, -1) : letters;
  const runs = stem.split(new RegExp(`[${VOWELS}]+`)).filter(Boolean);
  const maxRun = Math.max(...runs.map((r) => r.length), 0);
  if (maxRun >= 5) return true;
  if (maxRun === 4) {
    const run = runs.find((r) => r.length === 4)!;
    if (!LEGAL_CLUSTERS.some((c) => run.includes(c) || c.includes(run.slice(0, 3)))) return true;
  }
  // Vowel runs of 4+ ("uiea") are not French/English.
  const vruns = letters.split(new RegExp(`[^${VOWELS}]+`)).filter(Boolean);
  if (Math.max(...vruns.map((r) => r.length), 0) >= 4) return true;
  return false;
}

const NUMBER_WORDS =
  /\b(z[ée]ro|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cent(aine)?s?|mille|milliers?|demi[e]?|moiti[ée]|quart|tiers|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|half)\b/i;

/** Does the text carry a quantity — digits ("5 %", "17h30") or number words. */
export function hasNumber(text: string): boolean {
  return /\d/.test(text) || NUMBER_WORDS.test(text);
}

/** Does a field's wording expect a quantity? (percentages, durations, counts) */
export function fieldExpectsNumber(label: string, placeholder = ""): boolean {
  if (/%|\bmin(ute)?s?\b|\bheures?\b|\bdur[ée]e\b|combien|nombre|fr[ée]quence|\bh\)\s*$|créneau \(de/i.test(label)) return true;
  return /\d\s*%/.test(placeholder);
}

export function assessText(text: string, opts: { minWords?: number; requireNumber?: boolean } = {}): TextAssessment {
  const t = text.trim();
  const tokens = t.split(/\s+/).filter(Boolean);
  if (opts.minWords && tokens.length < opts.minWords) return { ok: false, code: "too_short", minWords: opts.minWords };

  const judged = tokens.map((w) => w.replace(/^[«"'(]+|[»"',.;:!?)]+$/g, "")).filter((w) => norm(w).replace(/[^a-z]/g, "").length >= 4);
  const bad = judged.filter(isImplausibleWord);
  // Block only when the nonsense DOMINATES: 2+ implausible words and ≥ 40 % of
  // the judged words, or a single-word answer that is itself implausible.
  const dominant = (bad.length >= 2 && bad.length / Math.max(1, judged.length) >= 0.4) || (judged.length === 1 && bad.length === 1);
  if (dominant) return { ok: false, code: "gibberish", words: [...new Set(bad)].slice(0, 4) };

  if (opts.requireNumber && t.length > 0 && !hasNumber(t)) return { ok: false, code: "need_number" };
  return { ok: true };
}

/** The learner-facing reason, from the app's translator. */
export function assessmentReason(a: TextAssessment, t: (key: string, vars?: Record<string, string | number>) => string): string | null {
  if (a.ok) return null;
  if (a.code === "gibberish") return t("tc.gibberish", { words: a.words.join(", ") });
  if (a.code === "too_short") return t("tc.tooShort", { n: a.minWords });
  return t("tc.needNumber");
}
