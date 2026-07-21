/**
 * shuffle.ts — deterministic, seeded shuffling (pure).
 *
 * Quiz questions are served in a RANDOM order that is STABLE per learner: the
 * seed derives from (enrollmentId, quizKey), so the offline bundle, every
 * rebuild and the server-side scoring all see the same order — while two
 * learners sitting next to each other see different ones (anti-copying).
 */

/** FNV-1a 32-bit hash of a string → numeric seed. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — tiny, fast, deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with a seeded PRNG. Returns a NEW array; input untouched. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rnd = mulberry32(hashSeed(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Shuffle quiz questions for one learner. PROFILING questions (self-positioning,
 * no right answer) are deliberately kept at the END, in their authored order —
 * they are designed as closing questions, not knowledge checks.
 */
export function shuffleQuestions<T extends { profiling?: boolean }>(questions: readonly T[], seed: string): T[] {
  const scored = questions.filter((q) => !q.profiling);
  const profiling = questions.filter((q) => q.profiling);
  return [...seededShuffle(scored, seed), ...profiling];
}
