/**
 * notify/send.ts — one-off transactional sends (invitations, verification, OTP).
 *
 * Thin convenience layer over the delivery dispatcher (which handles SMTP /
 * webhook / console fallback). Unlike the enrolment notification queue these are
 * sent immediately and not persisted as Notification rows.
 */
import { randomUUID } from "node:crypto";
import { deliver, type DeliveryChannel, type DeliveryResult } from "./dispatcher.js";

export async function sendTransactional(params: {
  to: string; channel: DeliveryChannel; subject?: string; body: string; kind?: string;
}): Promise<DeliveryResult> {
  return deliver({
    id: randomUUID(), recipientKind: params.kind ?? "USER", recipient: params.to,
    channel: params.channel, subject: params.subject ?? null, body: params.body,
  });
}

export const sendEmail = (to: string, subject: string, body: string) =>
  sendTransactional({ to, channel: "EMAIL", subject, body });
export const sendSms = (to: string, body: string) =>
  sendTransactional({ to, channel: "SMS", body });
export const sendWhatsapp = (to: string, body: string) =>
  sendTransactional({ to, channel: "WHATSAPP", body });

/**
 * Reach a person over e-mail AND, when a number is on file, a mobile channel.
 * In francophone Africa e-mail under-reaches (spec §7.1), so important messages
 * (invitations, OTP) go multi-channel. Returns every attempt's result.
 */
export async function sendMultichannel(params: {
  email?: string | null; phone?: string | null; subject: string; body: string; mobileBody?: string;
}): Promise<DeliveryResult[]> {
  const out: DeliveryResult[] = [];
  if (params.email) out.push(await sendEmail(params.email, params.subject, params.body));
  if (params.phone) out.push(await sendWhatsapp(params.phone, params.mobileBody ?? params.body));
  return out;
}
