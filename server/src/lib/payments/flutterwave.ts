/**
 * flutterwave.ts — adaptateur du plan B (spec §09, EN VEILLE — à valider).
 *
 * Flutterwave v3 : checkout hébergé (POST /v3/payments → data.link), webhook
 * signé par l'en-tête `verif-hash` (valeur secrète fixée dans le dashboard),
 * vérité par GET /v3/transactions/verify_by_reference?tx_ref=… .
 * Sans clés configurées, l'adaptateur reste en veille (available() = false).
 */
import { timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { toAmountMajor } from "../../domain/payments/money.js";
import { ProviderError, headerValue, type CheckoutInput, type CheckoutResult, type PaymentProvider, type ProviderStatus, type WebhookVerification } from "./provider.js";

const BASE = () => env.FLUTTERWAVE_BASE_URL;

function hashesMatch(expected: string, presented: string): boolean {
  const a = Buffer.from(expected), b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const flutterwaveProvider: PaymentProvider = {
  key: "flutterwave",

  available() {
    return Boolean(env.FLUTTERWAVE_SECRET_KEY && env.FLUTTERWAVE_WEBHOOK_HASH);
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.available()) {
      throw new ProviderError(409, "provider_unconfigured",
        "Flutterwave n'est pas configuré (FLUTTERWAVE_SECRET_KEY / FLUTTERWAVE_WEBHOOK_HASH) — plan B en veille.");
    }
    const res = await fetch(`${BASE()}/v3/payments`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        tx_ref: input.paymentId,
        amount: toAmountMajor(input.amountMinor, input.currency),
        currency: input.currency,
        redirect_url: input.returnUrl,
        customer: { email: input.customer?.email ?? "client@declick.digital", name: input.customer?.name },
        customizations: { title: "DECLICK DIGITAL", description: input.description },
      }),
    }).catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `Flutterwave injoignable : ${e.message}`); });
    const json = await res.json().catch(() => null) as { status?: string; message?: string; data?: { link?: string } } | null;
    if (!res.ok || json?.status !== "success" || !json.data?.link) {
      throw new ProviderError(502, "checkout_failed", `Flutterwave a refusé l'initialisation (HTTP ${res.status} · ${json?.message ?? "?"})`);
    }
    return { paymentUrl: json.data.link, providerRef: input.paymentId };
  },

  verifyWebhook(headers, rawBody): WebhookVerification {
    const presented = headerValue(headers, "verif-hash");
    const secret = env.FLUTTERWAVE_WEBHOOK_HASH;
    const signatureOk = Boolean(secret && presented && hashesMatch(secret, presented));
    let body: { event?: string; data?: { id?: number | string; tx_ref?: string; status?: string; amount?: number; currency?: string; payment_type?: string } } = {};
    try { body = JSON.parse(rawBody); } catch { /* corps illisible → événement inconnu */ }
    const d = body.data ?? {};
    const status: ProviderStatus = d.status === "successful" ? "SUCCEEDED" : d.status === "failed" ? "FAILED" : "PENDING";
    return {
      signatureOk,
      eventId: d.id !== undefined ? String(d.id) : `${d.tx_ref ?? "?"}:${d.status ?? "?"}`,
      providerRef: d.tx_ref ?? null,
      status,
      currency: d.currency,
      method: d.payment_type,
    };
  },

  async fetchStatus(providerRef): Promise<{ status: ProviderStatus; raw?: unknown }> {
    if (!this.available()) return { status: "UNKNOWN" };
    const res = await fetch(`${BASE()}/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(providerRef)}`, {
      headers: { authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}` },
    }).catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `Flutterwave injoignable : ${e.message}`); });
    const json = await res.json().catch(() => null) as { status?: string; data?: { status?: string } } | null;
    const s = json?.data?.status;
    if (s === "successful") return { status: "SUCCEEDED", raw: json };
    if (s === "failed") return { status: "FAILED", raw: json };
    if (s === "pending") return { status: "PENDING", raw: json };
    return { status: "UNKNOWN", raw: json };
  },
};
