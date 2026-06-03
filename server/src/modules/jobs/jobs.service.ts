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
 * Journal trigger scheduler (Pilier 5.1) — pushes the PAM-injected journal prompt
 * at Day+1/+3/+5/+7/+10/+14 from the certification block start, independently of
 * learner activity. Idempotent per (enrolment, day); skips entries already done.
 */
export async function runJournalTriggers(now: Date = new Date()) {
  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", journalStartedAt: { not: null } },
    include: { user: true, courseVersion: true, completions: true, journalTriggers: true },
  });
  const created: { enrollmentId: string; day: number; body: string }[] = [];

  for (const e of enrollments) {
    const content = CourseContent.parse(e.courseVersion.content);
    const cert = content.blocks.find((b) => b.type === "CERTIFICATION");
    if (cert?.type !== "CERTIFICATION") continue;
    const days = Math.floor((now.getTime() - e.journalStartedAt!.getTime()) / MS_PER_DAY);

    for (const entry of cert.payload.journal.entries) {
      if (days < entry.day) continue;
      if (e.journalTriggers.some((t) => t.day === entry.day)) continue; // already fired
      if (e.completions.some((c) => c.blockIndex === cert.index && c.itemKey === `J+${entry.day}`)) continue; // already journaled
      const body = injectMomentAncrage(entry.prompt, e.momentAncrage);
      await prisma.journalTrigger.create({ data: { enrollmentId: e.id, day: entry.day } });
      await enqueueNotification({
        enrollmentId: e.id, recipientKind: "LEARNER", recipient: e.user.email, channel: "EMAIL",
        subject: `Votre journal de bord — Jour J+${entry.day}`, body, provider: "journal",
      });
      created.push({ enrollmentId: e.id, day: entry.day, body });
    }
  }
  return { scanned: enrollments.length, created };
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

    // Enqueue for delivery: learner channel → learner e-mail; admin → admin inbox.
    await enqueueNotification({
      enrollmentId: e.id,
      recipientKind: channel === "ADMIN" ? "ADMIN" : "LEARNER",
      recipient: channel === "ADMIN" ? "admin@kompetences.net" : e.user.email,
      channel: "EMAIL",
      subject: `Reprenez votre parcours (${stage})`,
      body, aiGenerated, provider,
    });

    // Secondary mobile channel per the re-engagement matrix (§7.2): J3 → push,
    // J7 → SMS/WhatsApp (reaches learners where e-mail does not). Admin stage skips.
    if (channel !== "ADMIN") {
      if (stage === "J3") {
        await enqueueNotification({
          enrollmentId: e.id, recipientKind: "LEARNER", recipient: e.user.email, channel: "PUSH",
          subject: `Reprenez votre parcours`, body, aiGenerated, provider,
        });
      } else if (stage === "J7" && e.user.phone) {
        await enqueueNotification({
          enrollmentId: e.id, recipientKind: "LEARNER", recipient: e.user.phone, channel: "WHATSAPP",
          body, aiGenerated, provider,
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
