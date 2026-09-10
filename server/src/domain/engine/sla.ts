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

/** Rappels multi-étages (décision produit 09/2026) : après la notification de
 *  dépôt complet (immédiate, à la soumission de la Section 5), le job
 *  quotidien relance l'administrateur tant que le projet n'est pas évalué —
 *  au moins trois relances pour tenir l'engagement de délai. */
export const SLA_REMINDER_STAGES = [
  { stage: 1, afterBusinessDays: 3, label: "Rappel mi-délai" },
  { stage: 2, afterBusinessDays: SLA_ALERT_BUSINESS_DAYS, label: "Urgence — 2 jours ouvrés restants" },
  { stage: 3, afterBusinessDays: SLA_TURNAROUND_BUSINESS_DAYS, label: "Engagement de délai atteint" },
] as const;

/** Étape de relance due (la plus avancée) pour un dossier non évalué ;
 *  0 = aucune relance due pour l'instant. Pure, testée. */
export function dueReminderStage(submittedAt: Date, now: Date): number {
  const days = businessDaysBetween(submittedAt, now);
  let due = 0;
  for (const s of SLA_REMINDER_STAGES) if (days >= s.afterBusinessDays) due = s.stage;
  return due;
}

function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
