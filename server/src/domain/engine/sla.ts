/**
 * sla.ts — service-level commitments for the Bloc 4 certification project.
 *
 * The platform commits to a 7-business-day evaluator feedback turnaround and
 * must alert the course administrator if a submitted project has not been
 * evaluated within 5 business days (spec §6.3, acceptance criterion #14).
 * Pure, deterministic, UTC-day based so it is fully unit-testable.
 */

/** Business days to wait before the admin SLA alert fires. */
export const SLA_ALERT_BUSINESS_DAYS = 5;

/** The learner-facing turnaround commitment (for messaging). */
export const SLA_TURNAROUND_BUSINESS_DAYS = 7;

/** Whole business days (Mon–Fri) elapsed from `start` to `end`, by calendar day. */
export function businessDaysBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  const cur = utcDay(start);
  const last = utcDay(end);
  let count = 0;
  while (cur < last) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) count++; // skip Sunday(0) and Saturday(6)
  }
  return count;
}

/** True once an un-evaluated submission has aged past the alert threshold. */
export function slaAlertDue(submittedAt: Date, now: Date): boolean {
  return businessDaysBetween(submittedAt, now) >= SLA_ALERT_BUSINESS_DAYS;
}

function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
