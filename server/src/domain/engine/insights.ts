/**
 * insights.ts — pedagogical insights from locally-stored xAPI statements (pure).
 *
 * The local mini-LRS accumulates granular traces (answered per question,
 * progressed on videos, time-on-task) that no other table holds. These helpers
 * turn SQL-aggregated rows into the four steering indicators surfaced in the
 * admin « Pilotage pédagogique » screen: question difficulty, real time spent
 * per item, video completion, and the course funnel. Pure — the SQL lives in
 * analytics.service.
 */

/** Parsed tail of an activity IRI: .../courses/{slug}/blocks/N/items/KEY[/questions/QID][/video]. */
export type ParsedActivity = { blockIndex: number | null; itemKey: string | null; questionId: string | null };

export function parseActivityPath(objectId: string): ParsedActivity {
  const seg = objectId.split("/");
  const at = (name: string) => {
    const i = seg.lastIndexOf(name);
    return i >= 0 && i + 1 < seg.length ? seg[i + 1]! : null;
  };
  const blockRaw = at("blocks");
  const blockIndex = blockRaw != null && /^\d+$/.test(blockRaw) ? Number(blockRaw) : null;
  return { blockIndex, itemKey: at("items"), questionId: at("questions") };
}

// --- 1. Question difficulty -------------------------------------------------

export type AnsweredRow = { objectId: string; total: number; correct: number };
export type QuestionDifficulty = {
  questionId: string; blockIndex: number | null; itemKey: string | null;
  total: number; correct: number; pctCorrect: number;
};

/** Per-question success rate, hardest first. Rows without a question id are dropped. */
export function questionDifficulty(rows: AnsweredRow[], minAnswers = 1): QuestionDifficulty[] {
  const out: QuestionDifficulty[] = [];
  for (const r of rows) {
    const p = parseActivityPath(r.objectId);
    if (!p.questionId || r.total < minAnswers) continue;
    out.push({
      questionId: p.questionId, blockIndex: p.blockIndex, itemKey: p.itemKey,
      total: r.total, correct: r.correct,
      pctCorrect: r.total === 0 ? 0 : Math.round((r.correct / r.total) * 100),
    });
  }
  return out.sort((a, b) => a.pctCorrect - b.pctCorrect || b.total - a.total);
}

// --- 2. Time on task per item ----------------------------------------------

export type TimeRow = { objectId: string; enrollmentId: string; seconds: number };
export type ItemTime = {
  blockIndex: number; itemKey: string; learners: number;
  /** Average time per learner, in seconds (question-level rows collapsed into their item). */
  avgSeconds: number;
};

export function timeByItem(rows: TimeRow[]): ItemTime[] {
  const byItem = new Map<string, { blockIndex: number; itemKey: string; perLearner: Map<string, number> }>();
  for (const r of rows) {
    const p = parseActivityPath(r.objectId);
    if (p.blockIndex == null || !p.itemKey || !(r.seconds > 0)) continue;
    const key = `${p.blockIndex}:${p.itemKey}`;
    const e = byItem.get(key) ?? { blockIndex: p.blockIndex, itemKey: p.itemKey, perLearner: new Map() };
    e.perLearner.set(r.enrollmentId, (e.perLearner.get(r.enrollmentId) ?? 0) + r.seconds);
    byItem.set(key, e);
  }
  return [...byItem.values()]
    .map((e) => {
      const totals = [...e.perLearner.values()];
      return {
        blockIndex: e.blockIndex, itemKey: e.itemKey, learners: totals.length,
        avgSeconds: Math.round(totals.reduce((a, x) => a + x, 0) / totals.length),
      };
    })
    .sort((a, b) => a.blockIndex - b.blockIndex || a.itemKey.localeCompare(b.itemKey));
}

// --- 3. Video completion ----------------------------------------------------

export type VideoRow = { objectId: string; enrollmentId: string; maxProgress: number };
export type VideoCompletion = {
  blockIndex: number | null; itemKey: string | null; learners: number;
  /** Mean of each learner's furthest progress (0–100). */
  avgPct: number;
  /** Share of learners who reached ≥ 90 % (0–100). */
  finishedPct: number;
};

export function videoCompletion(rows: VideoRow[]): VideoCompletion[] {
  const byVideo = new Map<string, { blockIndex: number | null; itemKey: string | null; best: number[] }>();
  for (const r of rows) {
    const p = parseActivityPath(r.objectId);
    if (!p.itemKey) continue;
    const key = `${p.blockIndex}:${p.itemKey}`;
    const e = byVideo.get(key) ?? { blockIndex: p.blockIndex, itemKey: p.itemKey, best: [] };
    e.best.push(Math.max(0, Math.min(1, r.maxProgress)));
    byVideo.set(key, e);
  }
  return [...byVideo.values()]
    .map((e) => ({
      blockIndex: e.blockIndex, itemKey: e.itemKey, learners: e.best.length,
      avgPct: Math.round((e.best.reduce((a, x) => a + x, 0) / e.best.length) * 100),
      finishedPct: Math.round((e.best.filter((x) => x >= 0.9).length / e.best.length) * 100),
    }))
    .sort((a, b) => (a.blockIndex ?? 99) - (b.blockIndex ?? 99) || (a.itemKey ?? "").localeCompare(b.itemKey ?? ""));
}

// --- 4. Course funnel --------------------------------------------------------

export type CompletionCountRow = { blockIndex: number; itemKey: string; completions: number };
export type FunnelStep = {
  blockIndex: number; itemKey: string; label: string;
  completions: number; pctOfEnrolled: number;
};

/**
 * Order the completion counts along the canonical required-item sequence so the
 * drop-off point reads left-to-right like the learner's journey.
 */
export function courseFunnel(
  requiredInOrder: { blockIndex: number; key: string; label: string }[],
  counts: CompletionCountRow[],
  enrolled: number,
): FunnelStep[] {
  const byKey = new Map(counts.map((c) => [`${c.blockIndex}:${c.itemKey}`, c.completions]));
  return requiredInOrder.map((r) => {
    const completions = byKey.get(`${r.blockIndex}:${r.key}`) ?? 0;
    return {
      blockIndex: r.blockIndex, itemKey: r.key, label: r.label, completions,
      pctOfEnrolled: enrolled === 0 ? 0 : Math.round((completions / enrolled) * 100),
    };
  });
}
