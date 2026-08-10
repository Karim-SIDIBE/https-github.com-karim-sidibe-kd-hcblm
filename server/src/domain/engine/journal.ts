/**
 * journal.ts — « part calculée par la plateforme » du critère S1 (socle
 * d'évaluation certifiante v1.1, §3) : décompte des entrées du journal, dates
 * de saisie et détection du rattrapage groupé (plus de deux entrées saisies le
 * même jour calendaire — bande 4 exclue). L'évaluateur ne relit pas le
 * calendrier : il note le signal de surcharge et l'ajustement.
 */

export type JournalRecap = {
  expected: number;
  completed: number;
  entries: { day: number; completedAt: string | null }[];
  groupedCatchup: boolean;
};

export function journalRecap(
  expected: { day: number }[],
  completions: { itemKey: string; completedAt: Date }[],
): JournalRecap {
  const entries = expected.map((e) => {
    const c = completions.find((x) => x.itemKey === `J+${e.day}`);
    return { day: e.day, completedAt: c ? c.completedAt.toISOString() : null };
  });
  const byDate = new Map<string, number>();
  for (const e of entries) {
    if (!e.completedAt) continue;
    const d = e.completedAt.slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }
  const groupedCatchup = [...byDate.values()].some((n) => n > 2);
  return { expected: expected.length, completed: entries.filter((e) => e.completedAt).length, entries, groupedCatchup };
}
