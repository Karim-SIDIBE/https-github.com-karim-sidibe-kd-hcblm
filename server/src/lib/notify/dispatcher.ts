/**
 * notify/dispatcher.ts — outbound delivery layer.
 *
 * Notifications are enqueued (status PENDING) by the engine, then delivered by
 * the dispatch job. Channel resolution is config-driven with a safe default:
 *   - WEBHOOK / EMAIL → POST the payload to NOTIFY_WEBHOOK_URL when set
 *     (an email gateway or automation webhook), otherwise log to console;
 *   - CONSOLE → log.
 * Replacing console with a real provider (SES, Postmark, SMTP) is a config swap.
 */
import { env } from "../../config/env.js";

export type DeliveryResult = { ok: boolean; provider: string; error?: string };

export type DeliverableNotification = {
  id: string;
  recipientKind: string;
  recipient: string;
  channel: "CONSOLE" | "EMAIL" | "WEBHOOK";
  subject?: string | null;
  body: string;
};

async function postWebhook(url: string, n: DeliverableNotification): Promise<DeliveryResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: n.id, to: n.recipient, kind: n.recipientKind, subject: n.subject ?? null, body: n.body,
      }),
    });
    if (!res.ok) return { ok: false, provider: "webhook", error: `webhook ${res.status}` };
    return { ok: true, provider: "webhook" };
  } catch (e) {
    return { ok: false, provider: "webhook", error: e instanceof Error ? e.message : "webhook error" };
  }
}

export async function deliver(n: DeliverableNotification): Promise<DeliveryResult> {
  if ((n.channel === "EMAIL" || n.channel === "WEBHOOK") && env.NOTIFY_WEBHOOK_URL) {
    return postWebhook(env.NOTIFY_WEBHOOK_URL, n);
  }
  // Console fallback (dev / unconfigured).
  console.log(`[notify ${n.channel}/${n.recipientKind}] → ${n.recipient}${n.subject ? ` · ${n.subject}` : ""}: ${n.body}`);
  return { ok: true, provider: "console" };
}
