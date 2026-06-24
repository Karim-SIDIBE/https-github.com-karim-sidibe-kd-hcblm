/**
 * competency.ts — cohort competency analytics. Aggregates the diagnostic quiz's
 * per-sub-area scores across a course's learners into an average per sub-area,
 * weakest first — revealing where the GROUP struggles (so the course owner knows
 * which content to reinforce). Pure (no I/O), unit-tested.
 */
import type { SubAreaScore } from "./progress.js";

export type CompetencyAggregate = { subArea: string; avgPct: number; learners: number };

/** Average each sub-area's score across learners; sorted weakest → strongest. */
export function aggregateCompetencies(perLearner: SubAreaScore[][]): CompetencyAggregate[] {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const scores of perLearner) {
    for (const s of scores) {
      if (!s || typeof s.pct !== "number") continue;
      const e = acc.get(s.subArea) ?? { sum: 0, n: 0 };
      e.sum += s.pct; e.n += 1;
      acc.set(s.subArea, e);
    }
  }
  return [...acc.entries()]
    .map(([subArea, { sum, n }]) => ({ subArea, avgPct: Math.round(sum / n), learners: n }))
    .sort((a, b) => a.avgPct - b.avgPct || a.subArea.localeCompare(b.subArea));
}
