/**
 * cinetpay.ts — adaptateur CinetPay, écrit contre la documentation officielle
 * (docs.cinetpay.com, vérifiée le 26/08/2026 — spec v3 · R1) :
 *  - initialisation : POST {base}/v2/payment (apikey, site_id, transaction_id,
 *    amount en unités MAJEURES, currency, description, notify_url, return_url) ;
 *  - notification : POST sur notify_url portant les champs cpm_*, signée par
 *    l'en-tête `x-token` = HMAC-SHA256 sur la CONCATÉNATION des champs du corps
 *    (ordre documenté ci-dessous), clé = SECRET KEY du back-office ;
 *  - vérité : POST {base}/v2/payment/check (transaction_id) — la notification
 *    n'est qu'un réveil, seul le check fait foi (contre-vérification imposée).
 *
 * La finalisation (codes réels, montants arrondis par canal) se valide en
 * sandbox à la réception des clés marchand (PAY-2) — d'ici là l'adaptateur est
 * complet mais `available()` reste faux sans configuration.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { toAmountMajor, toAmountMinor, isCurrency } from "../../domain/payments/money.js";
import { ProviderError, headerValue, type CheckoutInput, type CheckoutResult, type PaymentProvider, type ProviderStatus, type WebhookVerification } from "./provider.js";

const BASE = () => env.CINETPAY_BASE_URL;

/** Ordre documenté des champs entrant dans le HMAC de l'en-tête `x-token`. */
export const CINETPAY_HMAC_FIELDS = [
  "cpm_site_id", "cpm_trans_id", "cpm_trans_date", "cpm_amount", "cpm_currency",
  "signature", "payment_method", "cel_phone_num",
] as const;

/** Jeton HMAC-SHA256 (hex) sur la concaténation des champs du corps — pur, testé. */
export function computeCinetpayToken(fields: Record<string, string | undefined>, secretKey: string): string {
  const joined = CINETPAY_HMAC_FIELDS.map((f) => fields[f] ?? "").join("");
  return createHmac("sha256", secretKey).update(joined).digest("hex");
}

/** Comparaison à temps constant (longueurs d'abord — patron totp.ts). */
export function tokensMatch(expected: string, presented: string): boolean {
  const a = Buffer.from(expected), b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Corps de notification : CinetPay poste en x-www-form-urlencoded (parfois JSON). */
export function parseNotificationBody(rawBody: string): Record<string, string> {
  const t = rawBody.trim();
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]));
    } catch { /* retombe sur le format formulaire */ }
  }
  return Object.fromEntries(new URLSearchParams(t));
}

export const cinetpayProvider: PaymentProvider = {
  key: "cinetpay",

  available() {
    return Boolean(env.CINETPAY_API_KEY && env.CINETPAY_SITE_ID && env.CINETPAY_SECRET_KEY);
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.available()) {
      throw new ProviderError(409, "provider_unconfigured",
        "CinetPay n'est pas configuré (CINETPAY_API_KEY / CINETPAY_SITE_ID / CINETPAY_SECRET_KEY) — utilisez le fournisseur « manual » ou basculez de fournisseur.");
    }
    const res = await fetch(`${BASE()}/v2/payment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apikey: env.CINETPAY_API_KEY,
        site_id: env.CINETPAY_SITE_ID,
        transaction_id: input.paymentId,
        amount: toAmountMajor(input.amountMinor, input.currency),
        currency: input.currency,
        description: input.description,
        notify_url: `${env.PUBLIC_BASE_URL}/api/v1/payments/webhooks/cinetpay`,
        return_url: input.returnUrl,
        channels: "ALL",
        customer_email: input.customer?.email,
        customer_name: input.customer?.name,
      }),
    }).catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `CinetPay injoignable : ${e.message}`); });
    const json = await res.json().catch(() => null) as { code?: string; message?: string; data?: { payment_url?: string } } | null;
    if (!res.ok || !json?.data?.payment_url) {
      throw new ProviderError(502, "checkout_failed", `CinetPay a refusé l'initialisation (HTTP ${res.status} · ${json?.code ?? "?"} ${json?.message ?? ""})`.trim());
    }
    return { paymentUrl: json.data.payment_url, providerRef: input.paymentId };
  },

  verifyWebhook(headers, rawBody): WebhookVerification {
    const fields = parseNotificationBody(rawBody);
    const providerRef = fields.cpm_trans_id || null;
    // Un même événement rejoué porte les mêmes trans_id + trans_date → dédupliqué.
    const eventId = `${fields.cpm_trans_id ?? "?"}:${fields.cpm_trans_date ?? "?"}`;
    const presented = headerValue(headers, "x-token");
    const secret = env.CINETPAY_SECRET_KEY;
    const signatureOk = Boolean(secret && presented && tokensMatch(computeCinetpayToken(fields, secret), presented));
    let amountMinor: number | undefined;
    if (fields.cpm_amount && isCurrency(fields.cpm_currency ?? "")) {
      try { amountMinor = toAmountMinor(fields.cpm_amount, fields.cpm_currency as never); } catch { /* incohérent → contre-vérification tranchera */ }
    }
    return {
      signatureOk, eventId, providerRef,
      // La notification CinetPay ne fait jamais foi : statut PENDING pour
      // forcer la contre-vérification /v2/payment/check côté service.
      status: "PENDING",
      amountMinor, currency: fields.cpm_currency, method: fields.payment_method,
    };
  },

  async fetchStatus(providerRef): Promise<{ status: ProviderStatus; raw?: unknown }> {
    if (!this.available()) return { status: "UNKNOWN" };
    const res = await fetch(`${BASE()}/v2/payment/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apikey: env.CINETPAY_API_KEY, site_id: env.CINETPAY_SITE_ID, transaction_id: providerRef }),
    }).catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `CinetPay injoignable : ${e.message}`); });
    const json = await res.json().catch(() => null) as { code?: string; data?: { status?: string } } | null;
    const s = json?.data?.status?.toUpperCase();
    if (s === "ACCEPTED") return { status: "SUCCEEDED", raw: json };
    if (s === "REFUSED") return { status: "FAILED", raw: json };
    if (s === "WAITING_FOR_CUSTOMER" || s === "PENDING") return { status: "PENDING", raw: json };
    return { status: "UNKNOWN", raw: json };
  },
};
