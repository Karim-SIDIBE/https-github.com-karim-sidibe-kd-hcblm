/**
 * notifications.service.ts — enqueue + dispatch outbound notifications.
 */
import type { NotificationChannel, RecipientKind } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { deliver } from "../../lib/notify/dispatcher.js";

export type EnqueueInput = {
  enrollmentId?: string | null;
  recipientKind: RecipientKind;
  recipient: string;
  channel?: NotificationChannel;
  subject?: string;
  body: string;
  aiGenerated?: boolean;
  provider?: string;
};

export async function enqueueNotification(input: EnqueueInput) {
  return prisma.notification.create({
    data: {
      enrollmentId: input.enrollmentId ?? null,
      recipientKind: input.recipientKind,
      recipient: input.recipient,
      channel: input.channel ?? "EMAIL",
      subject: input.subject ?? null,
      body: input.body,
      aiGenerated: input.aiGenerated ?? false,
      provider: input.provider ?? null,
    },
  });
}

export type DispatchResult = { scanned: number; sent: number; failed: number };

/** Deliver all PENDING notifications (dispatch job). */
export async function dispatchPending(batchSize = 100): Promise<DispatchResult> {
  const pending = await prisma.notification.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let sent = 0;
  let failed = 0;
  for (const n of pending) {
    const result = await deliver({
      id: n.id, recipientKind: n.recipientKind, recipient: n.recipient,
      channel: n.channel, subject: n.subject, body: n.body,
    });
    await prisma.notification.update({
      where: { id: n.id },
      data: result.ok
        ? { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, provider: result.provider, error: null }
        : { status: "FAILED", attempts: { increment: 1 }, provider: result.provider, error: result.error ?? "échec" },
    });
    result.ok ? sent++ : failed++;
  }
  return { scanned: pending.length, sent, failed };
}

export async function listForEnrollment(enrollmentId: string) {
  return prisma.notification.findMany({ where: { enrollmentId }, orderBy: { createdAt: "asc" } });
}
