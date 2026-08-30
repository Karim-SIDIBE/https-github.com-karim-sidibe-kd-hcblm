/**
 * jobs.service.ts — scheduled jobs. In production a cron hits the endpoint; here
 * it can be run on demand and tested by back-dating `lastSeenAt`.
 */
import { prisma } from "../../db/prisma.js";
import { CourseContent } from "../../domain/content-model.js";
import { computeResume } from "../../domain/engine/resume.js";
import { dueStage, daysInactive, type Stage } from "../../domain/engine/reengagement.js";
import { injectMomentAncrage } from "../../domain/engine/injection.js";
import { slaAlertDue, SLA_ALERT_BUSINESS_DAYS, SLA_TURNAROUND_BUSINESS_DAYS } from "../../domain/engine/sla.js";
import { generateNudge } from "../../lib/ai/nudge.js";
import { dispatchEvent } from "../../lib/webhooks/webhooks.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import { journalMessage, reengagementMessage } from "../../lib/notify/templates.js";
import { courseInsights } from "../analytics/analytics.service.js";
import { DEFAULT_ALERT_THRESHOLDS, detectInsightAlerts, type AlertThresholds } from "../../domain/engine/insights.js";

const MS_PER_DAY = 86_400_000;
const ADMIN_EMAIL = "admin@kompetences.net";

/**
 * Bloc 4 SLA enforcement (spec §6.3, AC#14) — alert the course administrator
 * when a submitted certification project has not been evaluated within
 * 5 business days. Idempotent per submission via `slaAlertedAt`.
 */
export async function runProjectSlaAlerts(now: Date = new Date()) {
  const pending = await prisma.projectSubmission.findMany({
    where: { evaluatedAt: null, slaAlertedAt: null },
    include: { enrollment: { include: { user: true } }, evaluator: true },
  });
  const alerted: { enrollmentId: string; submittedAt: Date; evaluator: string | null }[] = [];

  for (const s of pending) {
    if (!slaAlertDue(s.submittedAt, now)) continue;
    const who = s.evaluator ? `assigné à ${s.evaluator.name}` : "non encore assigné";
    await enqueueNotification({
      enrollmentId: s.enrollmentId, recipientKind: "ADMIN", recipient: ADMIN_EMAIL,
      subject: `SLA dépassé — projet de ${s.enrollment.user.name} sans évaluation`,
      body:
        `Le projet de certification de ${s.enrollment.user.name} a été soumis le ` +
        `${s.submittedAt.toISOString().slice(0, 10)} et n'a pas reçu d'évaluation après ` +
        `${SLA_ALERT_BUSINESS_DAYS} jours ouvrés (engagement : ${SLA_TURNAROUND_BUSINESS_DAYS} jours ouvrés). ` +
        `Évaluateur : ${who}. Merci d'intervenir pour préserver l'engagement de délai.`,
      provider: "project-sla",
    });
    await prisma.projectSubmission.update({ where: { id: s.id }, data: { slaAlertedAt: now } });
    alerted.push({ enrollmentId: s.enrollmentId, submittedAt: s.submittedAt, evaluator: s.evaluator?.name ?? null });
  }
  return { scanned: pending.length, alerted };
}

/**
 * Journal trigger scheduler (Pilier 5.1) — pushes the PAM-injected journal
 * prompt at each entry's J+n offset from `journalStartedAt` (anchored on the
 * COMPLETION of micro-session 4.3 — « Amélioration » lot), independently of
 * learner activity. The notification is also the entry's UNLOCK signal: the
 * engine refuses a journal completion before its date. Idempotent per
 * (enrolment, day); skips entries already done.
 */
export async function runJournalTriggers(now: Date = new Date()) {
  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", journalStartedAt: { not: null } },
    include: { user: true, courseVersion: true, completions: true, journalTriggers: true },
  });
  const created: { enrollmentId: string; day: number; body: string }[] = [];
  const reminded: { enrollmentId: string; day: number }[] = [];

  for (const e of enrollments) {
    const content = CourseContent.parse(e.courseVersion.content);
    const cert = content.blocks.find((b) => b.type === "CERTIFICATION");
    if (cert?.type !== "CERTIFICATION") continue;
    const days = Math.floor((now.getTime() - e.journalStartedAt!.getTime()) / MS_PER_DAY);

    for (const entry of cert.payload.journal.entries) {
      if (days < entry.day) continue;
      if (e.completions.some((c) => c.blockIndex === cert.index && c.itemKey === `J+${entry.day}`)) continue; // already journaled
      const prompt = injectMomentAncrage(entry.prompt, e.momentAncrage);
      const fired = e.journalTriggers.find((t) => t.day === entry.day);
      if (!fired) {
        // Invitation à l'ouverture — formatée (salutation, lien, signature).
        const msg = journalMessage({ learnerName: e.user.name, day: entry.day, prompt });
        await prisma.journalTrigger.create({ data: { enrollmentId: e.id, day: entry.day } });
        await enqueueNotification({
          enrollmentId: e.id, recipientKind: "LEARNER", recipient: e.user.email, channel: "EMAIL",
          subject: msg.subject, body: msg.body, provider: "journal",
        });
        created.push({ enrollmentId: e.id, day: entry.day, body: msg.body });
        continue;
      }
      // Rappel bienveillant à 24 h (retours de test, P11 — promesse du contenu) :
      // l'entrée est ouverte depuis plus d'un jour et toujours vide. UNE SEULE
      // fois par entrée — la garde vit sur le déclencheur lui-même
      // (`remindedAt`), posée AVANT l'envoi : un job concurrent ou re-exécuté
      // ne peut pas ré-émettre (incident « Magali », 7 rappels J+6 : l'ancienne
      // garde lisait Notification.provider, que le dispatch réécrivait).
      if (fired.remindedAt) continue;
      if (now.getTime() - fired.sentAt.getTime() < MS_PER_DAY) continue;
      await prisma.journalTrigger.update({ where: { id: fired.id }, data: { remindedAt: now } });
      const msg = journalMessage({ learnerName: e.user.name, day: entry.day, prompt, reminder: true });
      await enqueueNotification({
        enrollmentId: e.id, recipientKind: "LEARNER", recipient: e.user.email, channel: "EMAIL",
        subject: msg.subject, body: msg.body, provider: `journal-reminder-${entry.day}`,
      });
      reminded.push({ enrollmentId: e.id, day: entry.day });
    }
  }
  return { scanned: enrollments.length, created, reminded };
}

export type ReEngagementRunResult = {
  scanned: number;
  created: { enrollmentId: string; stage: Stage; channel: string; body: string; aiGenerated: boolean }[];
};

/** Scan ACTIVE enrolments and emit any due re-engagement message (Pilier 6.4). */
export async function runReEngagement(now: Date = new Date()): Promise<ReEngagementRunResult> {
  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE" },
    include: { user: true, courseVersion: true, completions: true, reEngagements: true, course: { select: { organizationId: true } } },
  });

  const created: ReEngagementRunResult["created"] = [];

  for (const e of enrollments) {
    const lastActivity = e.lastSeenAt ?? e.startedAt;
    const days = daysInactive(lastActivity, now);
    const stage = dueStage(days);
    if (!stage) continue;

    // Already sent this stage during the current inactivity streak?
    const alreadySent = e.reEngagements.some((r) => r.stage === stage && r.sentAt > lastActivity);
    if (alreadySent) continue;

    const content = CourseContent.parse(e.courseVersion.content);
    const resume = computeResume(
      content,
      e.completions.map((c) => ({ blockIndex: c.blockIndex, itemKey: c.itemKey, scorePct: c.scorePct })),
      Boolean(e.momentAncrage),
      { blockIndex: e.lastBlockIndex, itemKey: e.lastItemKey },
    );
    const blockDurationEstimate = resume ? content.blocks[resume.blockIndex]?.durationEstimate ?? "" : "";

    // AI-personalized nudge (adaptive nudging); deterministic template fallback.
    const { channel, body, aiGenerated, provider } = await generateNudge(stage, {
      learnerName: e.user.name,
      momentAncrage: e.momentAncrage,
      isEnterprise: e.isEnterprise,
      resume,
      blockDurationEstimate,
    });

    await prisma.reEngagementMessage.create({ data: { enrollmentId: e.id, stage, channel, body } });

    // Mise en forme e-mail (P2 — retours de test) : salutation, lien direct de
    // reprise, signature — le nudge brut n'est plus envoyé tel quel.
    const msg = reengagementMessage({ stage, learnerName: e.user.name, nudge: body, admin: channel === "ADMIN" });

    // Enqueue for delivery: learner channel → learner e-mail; admin → admin inbox.
    await enqueueNotification({
      enrollmentId: e.id,
      recipientKind: channel === "ADMIN" ? "ADMIN" : "LEARNER",
      recipient: channel === "ADMIN" ? "admin@kompetences.net" : e.user.email,
      channel: "EMAIL",
      subject: msg.subject,
      body: msg.body, aiGenerated, provider,
    });

    // Secondary mobile channel per the re-engagement matrix (§7.2): J3 → push,
    // J7 → SMS/WhatsApp (reaches learners where e-mail does not). Admin stage skips.
    if (channel !== "ADMIN") {
      if (stage === "J3") {
        await enqueueNotification({
          enrollmentId: e.id, recipientKind: "LEARNER", recipient: e.user.email, channel: "PUSH",
          subject: msg.subject, body: msg.mobileBody, aiGenerated, provider,
        });
      } else if (stage === "J7" && e.user.phone) {
        await enqueueNotification({
          enrollmentId: e.id, recipientKind: "LEARNER", recipient: e.user.phone, channel: "WHATSAPP",
          body: msg.mobileBody, aiGenerated, provider,
        });
      }
    }

    // Day +14 re-engagement webhook (§8.2) — for enterprise / investor reporting.
    if (stage === "J14") {
      await dispatchEvent("REENGAGEMENT_DAY14", {
        enrollmentId: e.id, learnerId: e.userId, courseId: e.courseId, daysInactive: days,
      }, e.course.organizationId);
    }

    created.push({ enrollmentId: e.id, stage, channel, body, aiGenerated });
  }

  return { scanned: enrollments.length, created };
}

/**
 * Manual re-engagement of ONE learner (admin "Relancer" action) — reuses the
 * same personalised-nudge pipeline as the scheduled job, but on demand and
 * always learner-facing. Returns null if the enrolment is unknown.
 */
export async function nudgeOne(enrollmentId: string) {
  const e = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { user: true, courseVersion: true, completions: true },
  });
  if (!e) return null;
  const now = new Date();
  const raw = dueStage(daysInactive(e.lastSeenAt ?? e.startedAt, now));
  const stage: Stage = raw === "J3" || raw === "J7" ? raw : "J7"; // keep it learner-facing (never the admin J14)
  const content = CourseContent.parse(e.courseVersion.content);
  const resume = computeResume(
    content,
    e.completions.map((c) => ({ blockIndex: c.blockIndex, itemKey: c.itemKey, scorePct: c.scorePct })),
    Boolean(e.momentAncrage),
    { blockIndex: e.lastBlockIndex, itemKey: e.lastItemKey },
  );
  const blockDurationEstimate = resume ? content.blocks[resume.blockIndex]?.durationEstimate ?? "" : "";
  const { channel, body, aiGenerated, provider } = await generateNudge(stage, {
    learnerName: e.user.name, momentAncrage: e.momentAncrage, isEnterprise: e.isEnterprise, resume, blockDurationEstimate,
  });
  await prisma.reEngagementMessage.create({ data: { enrollmentId: e.id, stage, channel, body } });
  const msg = reengagementMessage({ stage, learnerName: e.user.name, nudge: body });
  await enqueueNotification({
    enrollmentId: e.id, recipientKind: "LEARNER", recipient: e.user.email, channel: "EMAIL",
    subject: msg.subject, body: msg.body, aiGenerated, provider,
  });
  return { sent: true as const, stage, channel, email: e.user.email };
}

/**
 * Pedagogical alerting (local-LRS level 2) — turn the steering indicators into
 * a weekly admin digest: questions failed below threshold, funnel break points,
 * deserted videos. Small cohorts stay silent by design (minimum samples).
 * Weekly + idempotent via the notification `provider` marker; a manual run
 * (jobs route) passes `force` to bypass the calendar gate.
 */
export async function runInsightsAlerts(
  now: Date = new Date(),
  opts: { force?: boolean; thresholds?: Partial<AlertThresholds> } = {},
) {
  if (!opts.force) {
    // Weekly gate: Monday, and nothing already sent in the last 6 days.
    if (now.getUTCDay() !== 1) return { skipped: true as const, courses: 0, alerts: 0 };
    const recent = await prisma.notification.findFirst({
      where: { provider: "insights-alert", createdAt: { gte: new Date(now.getTime() - 6 * MS_PER_DAY) } },
      select: { id: true },
    });
    if (recent) return { skipped: true as const, courses: 0, alerts: 0 };
  }
  const thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...(opts.thresholds ?? {}) };
  const courses = await prisma.course.findMany({ select: { id: true, slug: true } });
  let totalAlerts = 0;
  const perCourse: { courseId: string; slug: string; alerts: number }[] = [];
  for (const course of courses) {
    let insights;
    try { insights = await courseInsights(course.id); }
    catch { continue; } // no published version → nothing to steer
    const alerts = detectInsightAlerts(insights, thresholds);
    perCourse.push({ courseId: course.id, slug: course.slug, alerts: alerts.length });
    if (alerts.length === 0) continue;
    totalAlerts += alerts.length;
    const lines = alerts.slice(0, 12).map((a) => {
      const tag = a.kind === "question" ? "Question" : a.kind === "funnel" ? "Abandon" : "Vidéo";
      return `• [${tag}] ${a.label.slice(0, 90)}\n  ${a.detail}`;
    });
    if (alerts.length > 12) lines.push(`… et ${alerts.length - 12} autre(s) signal(aux).`);
    await enqueueNotification({
      recipientKind: "ADMIN", recipient: ADMIN_EMAIL, channel: "EMAIL",
      subject: `Pilotage pédagogique — ${alerts.length} signal(aux) sur « ${course.slug} »`,
      body:
        `Le pilotage hebdomadaire du parcours « ${course.slug} » relève ${alerts.length} point(s) d'attention ` +
        `(${insights.enrolled} inscrit(s)) :\n\n${lines.join("\n")}\n\n` +
        `Détails et exports : écran « Pilotage pédagogique » de l'administration.`,
      provider: "insights-alert",
    });
  }
  return { skipped: false as const, courses: perCourse.length, alerts: totalAlerts, perCourse };
}

// --- jobs monitor (M3) -------------------------------------------------------

/** Everything the admin monitor shows about the platform's background jobs. */
export const JOB_CATALOG = [
  { key: "notifications", label: "Notifications", description: "Livraison des e-mails / SMS / WhatsApp en attente.", cadence: "chaque minute" },
  { key: "webhooks-flush", label: "Webhooks sortants", description: "Livraison des webhooks en attente vers les intégrations.", cadence: "chaque minute" },
  { key: "lrs-forward", label: "Transfert LRS", description: "Transfert des traces xAPI vers un LRS externe (inactif sans LRS configuré).", cadence: "chaque minute" },
  { key: "re-engagement", label: "Relances J+3/7/14", description: "Détection des apprenants inactifs et envoi des relances personnalisées.", cadence: "toutes les heures" },
  { key: "journal-triggers", label: "Déclencheurs du journal", description: "Invitations au journal de bord (J+2 à J+15) + rappel bienveillant 24 h après pour les entrées restées vides.", cadence: "toutes les heures" },
  { key: "project-sla", label: "SLA projets Bloc 4", description: "Alerte l'admin quand un projet soumis attend une évaluation depuis 5 jours ouvrés.", cadence: "toutes les heures" },
  { key: "insights-alerts", label: "Alertes pédagogiques", description: "Digest hebdomadaire : questions sous seuil, ruptures d'entonnoir, vidéos désertées.", cadence: "hebdomadaire (lundi)" },
  { key: "scheduled-reports", label: "Rapports programmés", description: "Envoi des rapports de parcours programmés (hebdo/mensuel).", cadence: "toutes les heures" },
  { key: "retention", label: "Purge RGPD", description: "Exécute les effacements arrivés à échéance, purge tokens/journaux/codes expirés.", cadence: "toutes les heures" },
  { key: "lrs-retention", label: "Rétention xAPI", description: "Archive (NDJSON.gz) puis purge les traces granulaires au-delà de la fenêtre de rétention.", cadence: "toutes les heures" },
] as const;
export type JobKey = (typeof JOB_CATALOG)[number]["key"];

const JOB_RUNS_KEPT_DAYS = 60;

/**
 * Run a job and record the execution for the admin monitor. `skipIf` lets the
 * scheduler's minute-tick queues stay silent when there was nothing to do
 * (otherwise the table would grow by thousands of no-op rows a day).
 * Errors are recorded then rethrown — callers keep their own handling.
 */
export async function recordRun<T>(
  name: JobKey,
  trigger: "manual" | "scheduler",
  actorId: string | null | undefined,
  fn: () => Promise<T>,
  opts: { skipIf?: (result: T) => boolean } = {},
): Promise<T> {
  const startedAt = new Date();
  try {
    const result = await fn();
    if (!opts.skipIf?.(result)) {
      await prisma.jobRun.create({ data: { name, trigger, actorId: actorId ?? null, startedAt, finishedAt: new Date(), ok: true, result: (result ?? {}) as object } }).catch(() => {});
      await prisma.jobRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - JOB_RUNS_KEPT_DAYS * MS_PER_DAY) } } }).catch(() => {});
    }
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.jobRun.create({ data: { name, trigger, actorId: actorId ?? null, startedAt, finishedAt: new Date(), ok: false, error } }).catch(() => {});
    throw e;
  }
}

/** The monitor's main view: every known job + its last recorded run. */
export async function jobsOverview() {
  const lastRuns = await Promise.all(JOB_CATALOG.map((j) =>
    prisma.jobRun.findFirst({ where: { name: j.key }, orderBy: { startedAt: "desc" } })));
  return JOB_CATALOG.map((j, i) => {
    const r = lastRuns[i];
    return {
      ...j,
      lastRun: r ? {
        id: r.id, trigger: r.trigger, startedAt: r.startedAt, finishedAt: r.finishedAt, ok: r.ok,
        durationMs: r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null,
        result: r.result, error: r.error,
      } : null,
    };
  });
}

/** Paged execution history (optionally for one job). */
export async function listJobRuns(opts: { name?: string; page?: number; pageSize?: number } = {}) {
  const where = opts.name ? { name: opts.name } : {};
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 30;
  const [total, rows] = await Promise.all([
    prisma.jobRun.count({ where }),
    prisma.jobRun.findMany({ where, orderBy: { startedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total };
}
