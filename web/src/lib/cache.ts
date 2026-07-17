/**
 * cache.ts — last-known progress + resume snapshots per enrolment.
 *
 * The offline bundle carries course content but not the learner's completion
 * state, so we cache the latest progress/resume (from the API and from sync
 * results) to render the dashboard offline.
 */
export type ProgressSnapshot = {
  blocks: { index: number; type: string; title: string; state: string; completedKeys: string[] }[];
  completedBlockIndexes: number[];
  currentBlockIndex: number;
  courseCompleted: boolean;
  productivity?: { score: number; earned: number; total: number };
};
export type ResumeSnapshot = { blockIndex: number; itemKey: string; positionSec: number; durationSec: number | null } | null;

export type PositionSnapshot = { positionSec: number; durationSec: number | null };

const pKey = (eid: string) => `klms_progress_${eid}`;
const rKey = (eid: string) => `klms_resume_${eid}`;
const posKey = (eid: string, block: number, item: string) => `klms_pos_${eid}_${block}_${item}`;

function read<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private mode */ }
}

export const getCachedProgress = (eid: string) => read<ProgressSnapshot>(pKey(eid));
export const setCachedProgress = (eid: string, p: ProgressSnapshot) => write(pKey(eid), p);
export const getCachedResume = (eid: string) => read<ResumeSnapshot>(rKey(eid));
export const setCachedResume = (eid: string, r: ResumeSnapshot) => write(rKey(eid), r);
export const getCachedPosition = (eid: string, block: number, item: string) => read<PositionSnapshot>(posKey(eid, block, item));
export const setCachedPosition = (eid: string, block: number, item: string, v: PositionSnapshot) => write(posKey(eid, block, item), v);

/** Drop every cached in-video position for an enrolment (used when the server
 *  shows a fresh/reset enrolment — stale offsets would resume mid-video). */
export function clearCachedPositions(eid: string) {
  try {
    const prefix = `klms_pos_${eid}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch { /* no storage */ }
}

// --- badge "seen" tracking (powers the unlock celebration) -------------------

export type BadgeSnapshot = { type: string; message?: string | null; peerNotified?: boolean };

const bKey = (eid: string) => `klms_badges_seen_${eid}`;

/** Reconcile the "seen" set with the SERVER's badge list.
 *  - First contact: record the current badges as already seen, so pre-existing
 *    badges are never (re-)celebrated on this device.
 *  - Enrolment reset (server has NO badges anymore): clear the set, so the
 *    re-earned badges get their celebration again. */
export function syncSeenBadges(eid: string, types: string[]) {
  const seen = read<string[]>(bKey(eid));
  if (seen === null) { write(bKey(eid), types); return; }
  if (types.length === 0 && seen.length > 0) write(bKey(eid), []);
}
/** Badges present in `badges` that this device never celebrated. */
export function unseenBadges(eid: string, badges: BadgeSnapshot[]): BadgeSnapshot[] {
  const seen = read<string[]>(bKey(eid)) ?? [];
  return badges.filter((b) => !seen.includes(b.type));
}
export function markBadgesSeen(eid: string, types: string[]) {
  const seen = read<string[]>(bKey(eid)) ?? [];
  write(bKey(eid), [...new Set([...seen, ...types])]);
}
