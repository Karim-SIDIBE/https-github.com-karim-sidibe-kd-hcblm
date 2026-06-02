/**
 * jobs.service.ts — scheduled jobs. In production a cron hits the endpoint; here
 * it can be run on demand and tested by back-dating `lastSeenAt`.
 */
import { prisma } from "../../db/prisma.js";
import { CourseContent } from "../../domain/content-model.js";
import { computeResume } from "../../domain/engine/resume.js";
import { dueStage, daysInactive, type Stage } from "../../domain/engine/reengagement.js";
import { generateNudge } from "../../lib/ai/nudge.js";
import { enqueueNotification } from "../notifications/notifications.service.js";

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
