/**
 * notify/email.ts — transactional e-mail via SMTP (nodemailer).
 *
 * Configured by SMTP_URL (+ MAIL_FROM). The transport is created lazily and
 * reused. When SMTP is not configured, the dispatcher falls back to the webhook
 * gateway, then to console — so everything runs with zero config in dev/beta.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";

let cached: Transporter | null | undefined; // undefined = uninitialised, null = not configured

function transport(): Transporter | null {
  if (cached === undefined) cached = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;
  return cached;
}

export function smtpConfigured(): boolean {
  return Boolean(env.SMTP_URL);
}

/** Send a plain-text e-mail (with a minimal HTML wrap). Throws if SMTP is unset. */
export async function sendSmtpEmail(to: string, subject: string, body: string): Promise<void> {
  const t = transport();
  if (!t) throw new Error("SMTP not configured");
  const html = `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;line-height:1.5;white-space:pre-wrap">${escapeHtml(body)}</div>`;
  await t.sendMail({ from: env.MAIL_FROM ?? `${env.BRAND_NAME} <no-reply@localhost>`, to, subject, text: body, html });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
