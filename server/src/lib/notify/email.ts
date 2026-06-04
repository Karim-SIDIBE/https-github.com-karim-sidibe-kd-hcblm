/**
 * notify/email.ts — transactional e-mail via SMTP (nodemailer).
 *
 * Configured by SMTP_URL (+ MAIL_FROM). The URL is parsed into explicit
 * host/port/secure/auth so we can also apply SMTP_TLS_INSECURE (skip TLS
 * certificate-NAME verification) — needed for shared hosts whose cert is for
 * the panel domain (e.g. LWS *.lwspanel.com) while you connect via a vanity
 * hostname. The transport is created lazily and reused. When SMTP is not
 * configured the dispatcher falls back to the webhook gateway, then console.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";

let cached: Transporter | null | undefined; // undefined = uninitialised, null = not configured

function build(): Transporter | null {
  if (!env.SMTP_URL) return null;
  const u = new URL(env.SMTP_URL);
  const secure = u.protocol === "smtps:" || u.port === "465";
  return nodemailer.createTransport({
    host: u.hostname,
    port: u.port ? Number(u.port) : secure ? 465 : 587,
    secure,
    auth: u.username ? { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) } : undefined,
    ...(env.SMTP_TLS_INSECURE ? { tls: { rejectUnauthorized: false } } : {}),
  });
}

function transport(): Transporter | null {
  if (cached === undefined) cached = build();
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
