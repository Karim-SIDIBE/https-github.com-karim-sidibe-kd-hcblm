/**
 * answers.ts — the learner's recorded answers (frozen results).
 *
 * Once an exercise/quiz is completed its first submission is final (server-
 * enforced): revisiting shows the recorded answers read-only. This module
 * fetches GET /enrollments/:id/answers and mirrors it in localStorage so the
 * recap views also render offline. Videos are not part of this map (positions
 * live elsewhere and stay freely rewatchable).
 */
import { useEffect, useState } from "react";
import { api } from "./app";

export type AnswerRow = {
  blockIndex: number;
  itemType: string;
  itemKey: string;
  scorePct: number | null;
  completedAt: string;
  data: unknown;
};
/** Keyed `${blockIndex}:${itemKey}`. */
export type AnswersMap = Record<string, AnswerRow>;

const aKey = (eid: string) => `klms_answers_${eid}`;

export function getCachedAnswers(eid: string): AnswersMap | null {
  try { const v = localStorage.getItem(aKey(eid)); return v ? (JSON.parse(v) as AnswersMap) : null; } catch { return null; }
}
function setCachedAnswers(eid: string, m: AnswersMap) {
  try { localStorage.setItem(aKey(eid), JSON.stringify(m)); } catch { /* quota / private mode */ }
}

export async function fetchAnswers(eid: string): Promise<AnswersMap> {
  const rows = await api.get<AnswerRow[]>(`/enrollments/${eid}/answers`);
  const map: AnswersMap = Object.fromEntries((rows ?? []).map((r) => [`${r.blockIndex}:${r.itemKey}`, r]));
  setCachedAnswers(eid, map);
  return map;
}

/** Cached-first answers map; refreshed from the API when online. `null` until
 *  the first value (cache or network) is available. */
export function useAnswers(eid: string): AnswersMap | null {
  const [map, setMap] = useState<AnswersMap | null>(() => getCachedAnswers(eid));
  useEffect(() => {
    let alive = true;
    setMap(getCachedAnswers(eid));
    if (navigator.onLine) {
      fetchAnswers(eid).then((m) => { if (alive) setMap(m); }).catch(() => { if (alive) setMap((cur) => cur ?? {}); });
    } else {
      setMap((cur) => cur ?? {});
    }
    return () => { alive = false; };
  }, [eid]);
  return map;
}

/** Convenience: the recorded answer of one item, or undefined. */
export const answerOf = (map: AnswersMap | null, blockIndex: number, itemKey: string): AnswerRow | undefined =>
  map?.[`${blockIndex}:${itemKey}`];
