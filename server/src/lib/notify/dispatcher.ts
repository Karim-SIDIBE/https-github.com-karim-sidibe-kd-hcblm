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
import { smtpConfigured, sendSmtpEmail } from "./email.js";

export type DeliveryResult = { ok: boolean; provider: string; error?: string };

export type DeliveryChannel = "CONSOLE" | "EMAIL" | "WEBHOOK" | "SMS" | "WHATSAPP" | "PUSH";

export type DeliverableNotification = {
  id: string;
  recipientKind: string;
  recipient: string;
  channel: DeliveryChannel;
  subject?: string | null;
  body: string;
};

async function postGateway(url: string, provider: string, n: DeliverableNotification): Promise<DeliveryResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: n.id, to: n.recipient, kind: n.recipientKind, channel: n.channel,
        subject: n.subject ?? null, body: n.body,
      }),
    });
    if (!res.ok) return { ok: false, provider, error: `${provider} ${res.status}` };
    return { ok: true, provider };
  } catch (e) {
    return { ok: false, provider, error: e instanceof Error ? e.message : `${provider} error` };
  }
}

/** Channel → configured gateway URL (when set). */
function gatewayFor(channel: DeliveryChannel): { url: string; provider: string } | null {
  switch (channel) {
    case "SMS": return env.SMS_WEBHOOK_URL ? { url: env.SMS_WEBHOOK_URL, provider: "sms" } : null;
    case "WHATSAPP": return env.WHATSAPP_WEBHOOK_URL ? { url: env.WHATSAPP_WEBHOOK_URL, provider: "whatsapp" } : null;
    case "PUSH": return env.PUSH_WEBHOOK_URL ? { url: env.PUSH_WEBHOOK_URL, provider: "push" } : null;
    case "EMAIL":
    case "WEBHOOK": return env.NOTIFY_WEBHOOK_URL ? { url: env.NOTIFY_WEBHOOK_URL, provider: "webhook" } : null;
    default: return null;
  }
}

export async function deliver(n: DeliverableNotification): Promise<DeliveryResult> {
  // Real transactional e-mail via SMTP takes priority over the generic webhook.
  if (n.channel === "EMAIL" && smtpConfigured()) {
    try { await sendSmtpEmail(n.recipient, n.subject ?? "", n.body); return { ok: true, provider: "smtp" }; }
    catch (e) {
      const error = e instanceof Error ? e.message : "smtp error";
      console.error(`[notify smtp] échec d'envoi à ${n.recipient}: ${error}`);
      return { ok: false, provider: "smtp", error };
    }
  }
  const gateway = gatewayFor(n.channel);
  if (gateway) return postGateway(gateway.url, gateway.provider, n);
  // Console fallback (dev / unconfigured gateway).
  console.log(`[notify ${n.channel}/${n.recipientKind}] → ${n.recipient}${n.subject ? ` · ${n.subject}` : ""}: ${n.body}`);
  return { ok: true, provider: "console" };
}
