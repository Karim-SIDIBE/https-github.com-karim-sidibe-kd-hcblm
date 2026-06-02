/**
 * webhooks.service.ts — manage outbound webhook subscriptions (§8.2).
 * CRUD over `Webhook`; event delivery lives in lib/webhooks.
 */
import { randomBytes } from "node:crypto";
import type { WebhookEvent } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  "BADGE_ISSUED", "BLOCK_COMPLETED", "PROJECT_SUBMITTED",
  "REENGAGEMENT_DAY14", "CERTIFICATE_ISSUED", "EXERCISE_SUBMITTED",
];

export async function createWebhook(input: { url: string; events: WebhookEvent[]; organizationId?: string | null; secret?: string }) {
  const secret = input.secret ?? randomBytes(24).toString("hex");
  return prisma.webhook.create({
    data: { url: input.url, events: input.events, organizationId: input.organizationId ?? null, secret },
  });
}

export async function listWebhooks(organizationId?: string | null) {
  return prisma.webhook.findMany({
    where: organizationId === undefined ? {} : { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateWebhook(id: string, patch: { url?: string; events?: WebhookEvent[]; active?: boolean }) {
  return prisma.webhook.update({ where: { id }, data: patch });
}

export async function deleteWebhook(id: string) {
  await prisma.webhook.delete({ where: { id } });
  return { deleted: true };
}

export async function listDeliveries(webhookId: string, limit = 50) {
  return prisma.webhookDelivery.findMany({
    where: { webhookId }, orderBy: { createdAt: "desc" }, take: limit,
  });
}
