/**
 * jobs-scheduler.ts — internal job scheduler.
 *
 * Historically every queue (notifications, webhooks, LRS forwarding) and every
 * periodic job (re-engagement J+3/7/14, journal triggers, project SLA, scheduled
 * reports, RGPD retention) was only reachable through the POST /jobs/* endpoints
 * — nothing called them in production, so peer/badge e-mails sat PENDING forever.
 *
 * This scheduler runs them from inside the API process:
 *   - FAST tick (every 60 s): drain the delivery queues — notifications
 *     (e-mail/SMS/WhatsApp/push), outbound webhooks, LRS forwarding (no-op when
 *     no LRS is configured).
 *   - SLOW tick (hourly): the date-gated jobs. All of them are idempotent
 *     (deduped per stage/day/submission), so an hourly cadence is safe.
 *
 * Exactly ONE scheduler runs per container: the cluster primary in multi-worker
 * mode (API_WORKERS > 1), the single process otherwise. The /jobs/* endpoints
 * stay available for manual runs. Disable with JOBS_SCHEDULER=false (e.g. to go
 * back to an external cron).
 */
import { env } from "../config/env.js";
import { dispatchPending } from "../modules/notifications/notifications.service.js";
import { runReEngagement, runJournalTriggers, runProjectSlaAlerts, runInsightsAlerts, recordRun, type JobKey } from "../modules/jobs/jobs.service.js";
import { runDueReports } from "../modules/reports/reports.service.js";
import { runRetentionPurge } from "../modules/rgpd/rgpd.service.js";
import { forwardPending } from "./lrs/forwarder.js";
import { archiveGranularStatements } from "./lrs/retention.js";
import { flushPendingWebhooks } from "./webhooks/webhooks.js";

const FAST_MS = 60_000;      // delivery queues
const SLOW_MS = 3_600_000;   // date-gated jobs

type Logger = { info: (msg: string) => void; error: (msg: string) => void };

export function startJobsScheduler(log: Logger = { info: console.log, error: console.error }): () => void {
  if (!env.JOBS_SCHEDULER || env.NODE_ENV === "test") return () => {};

  let fastBusy = false;
  let slowBusy = false;

  // Every job is recorded (JobRun → admin monitor) and isolated: one failing
  // job no longer aborts the rest of its tick. `skipIf` keeps the minute-tick
  // queues from writing thousands of no-op rows a day.
  const safe = async <T>(name: JobKey, fn: () => Promise<T>, skipIf?: (r: T) => boolean): Promise<T | null> => {
    try { return await recordRun(name, "scheduler", null, fn, skipIf ? { skipIf } : {}); }
    catch (e) { log.error(`[jobs] ${name} en erreur : ${e instanceof Error ? e.message : e}`); return null; }
  };

  const fast = async () => {
    if (fastBusy) return; // a slow SMTP batch must not overlap the next tick
    fastBusy = true;
    const n = await safe("notifications", () => dispatchPending(200), (r) => r.scanned === 0);
    if (n && n.scanned > 0) log.info(`[jobs] notifications : ${n.sent} envoyée(s), ${n.failed} échec(s)`);
    await safe("webhooks-flush", () => flushPendingWebhooks(200), (r) => r.scanned === 0);
    await safe("lrs-forward", () => forwardPending(200), (r) => r.skipped === true || (r.forwarded === 0 && r.failed === 0));
    fastBusy = false;
  };

  const slow = async () => {
    if (slowBusy) return;
    slowBusy = true;
    const now = new Date();
    const r = await safe("re-engagement", () => runReEngagement(now));
    if (r && r.created.length > 0) log.info(`[jobs] re-engagement : ${r.created.length} relance(s)`);
    const j = await safe("journal-triggers", () => runJournalTriggers(now));
    if (j && j.created.length > 0) log.info(`[jobs] journal : ${j.created.length} déclencheur(s)`);
    await safe("project-sla", () => runProjectSlaAlerts(now));
    const ia = await safe("insights-alerts", () => runInsightsAlerts(now));
    if (ia && !ia.skipped && ia.alerts > 0) log.info(`[jobs] pilotage pédagogique : ${ia.alerts} signal(aux) notifié(s)`);
    await safe("scheduled-reports", () => runDueReports(now));
    await safe("retention", () => runRetentionPurge(now));
    const x = await safe("lrs-retention", () => archiveGranularStatements(now));
    if (x && x.archived > 0) log.info(`[jobs] rétention xAPI : ${x.archived} statement(s) archivé(s) → ${x.file}`);
    slowBusy = false;
  };

  const timers = [setInterval(() => void fast(), FAST_MS), setInterval(() => void slow(), SLOW_MS)];
  // Boot catch-up: drain any backlog immediately (e.g. peer e-mails enqueued
  // before this scheduler existed), then run the date-gated jobs once.
  void fast().then(() => slow());
  log.info("[jobs] planificateur interne démarré (livraison 60 s · jobs planifiés 1 h)");

  return () => timers.forEach(clearInterval);
}
