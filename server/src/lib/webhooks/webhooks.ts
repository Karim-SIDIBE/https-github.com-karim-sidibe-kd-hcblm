/**
 * webhooks.ts — outbound event webhooks (§8.2).
 *
 * The engine calls `dispatchEvent` for the five contract events (badge issuance,
 * block completion, Block 4 project submission, Day +14 re-engagement, certificate
 * issuance) plus exercise submission. Each matching subscription gets a durable
 * `WebhookDelivery` row; `flushPendingWebhooks` sends them with an HMAC-SHA256
 * signature so receivers (employer HR, LinkedIn import, investor reporting) can
 * verify authenticity. Dispatch is best-effort and never blocks the learner path.
 */
import { createHmac } from "node:crypto";
import type { WebhookEvent } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

/** HMAC-SHA256 of the raw JSON body, hex-encoded (sent as `x-kd-signature`). */
export function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Fan an event out to every active subscription that matches the event's
 * organization (org-scoped webhooks) or is platform-level (organizationId null).
 * Creates PENDING delivery rows. Returns the number queued. Never throws.
 */
export async function dispatchEvent(
  event: WebhookEvent,
  payload: Record<string, unknown>,
  organizationId?: string | null,
): Promise<number> {
  try {
    const hooks = await prisma.webhook.findMany({
      where: {
        active: true,
        events: { has: event },
        OR: [{ organizationId: null }, ...(organizationId ? [{ organizationId }] : [])],
      },
    });
    if (hooks.length === 0) return 0;
    const envelope = { event, occurredAt: new Date().toISOString(), data: payload };
    await prisma.webhookDelivery.createMany({
      data: hooks.map((h) => ({ webhookId: h.id, event, payload: envelope as object })),
    });
    return hooks.length;
  } catch (e) {
    console.error(`[webhook] dispatch failed for ${event}:`, e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Deliver up to `batchSize` pending webhook rows. Returns a small summary. */
export async function flushPendingWebhooks(batchSize = 100) {
  const pending = await prisma.webhookDelivery.findMany({
    where: { status: "PENDING" },
    include: { webhook: true },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });
  let sent = 0;
  let failed = 0;
  for (const d of pending) {
    const body = JSON.stringify(d.payload);
    const signature = signPayload(d.webhook.secret, body);
    try {
      const res = await fetch(d.webhook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kd-event": d.event,
          "x-kd-signature": signature,
        },
        body,
      });
      if (res.ok) {
        sent++;
        await prisma.webhookDelivery.update({
          where: { id: d.id },
          data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, responseCode: res.status, error: null },
        });
      } else {
        failed++;
        await prisma.webhookDelivery.update({
          where: { id: d.id },
          data: { status: "FAILED", attempts: { increment: 1 }, responseCode: res.status, error: `HTTP ${res.status}` },
        });
      }
    } catch (e) {
      failed++;
      await prisma.webhookDelivery.update({
        where: { id: d.id },
        data: { status: "FAILED", attempts: { increment: 1 }, error: e instanceof Error ? e.message : "fetch error" },
      });
    }
  }
  return { scanned: pending.length, sent, failed };
}
