/**
 * format.ts — pure presentation helpers (unit-tested).
 */

/** Human-readable session duration, FR. 0/unknown → "—". */
export function formatDuration(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return "—";
  if (totalSec < 60) return `${Math.round(totalSec)} s`;
  const m = Math.round(totalSec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h} h ${String(mm).padStart(2, "0")}` : `${h} h`;
}

export type Session = { key: string; durationSec: number; done: boolean };

/** Remaining seconds across not-yet-completed sessions. */
export function remainingSeconds(sessions: Session[]): number {
  return sessions.filter((s) => !s.done).reduce((a, s) => a + (s.durationSec || 0), 0);
}

/** "Il reste 24 min" style label, or null when nothing remains. */
export function remainingLabel(sessions: Session[]): string | null {
  const r = remainingSeconds(sessions);
  return r > 0 ? `Il reste ${formatDuration(r)}` : null;
}
