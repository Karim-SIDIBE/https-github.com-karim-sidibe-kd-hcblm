/**
 * jobs.service.ts — scheduled jobs. In production a cron hits the endpoint; here
 * it can be run on demand and tested by back-dating `lastSeenAt`.
 */
import { prisma } from "../../db/prisma.js";
import { CourseContent } from "../../domain/content-model.js";
import { computeResume } from "../../domain/engine/resume.js";
import { dueStage, daysInactive, type Stage } from "../../domain/engine/reengagement.js";
import { injectMomentAncrage } from "../../domain/engine/injection.js";
import { generateNudge } from "../../lib/ai/nudge.js";
import { enqueueNotification } from "../notifications/notifications.service.js";

const MS_PER_DAY = 86_400_000;

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
    include: { user: true, courseVersion: true, completions: true, reEngagements: true },
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

    created.push({ enrollmentId: e.id, stage, channel, body, aiGenerated });
  }

  return { scanned: enrollments.length, created };
}
