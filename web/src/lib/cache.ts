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
