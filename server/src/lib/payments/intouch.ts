/**
 * intouch.ts — adaptateur InTouch / TouchPay (TouchPoint Financial Services,
 * EDP BCEAO, seul agrégateur présent sur le rail PI-SPI à la liste du
 * 31/07/2026). EN VEILLE — à finaliser à l'onboarding marchand : la
 * documentation détaillée d'InTouch vit dans le portail partenaire
 * (Réglages → API), seule l'intégration web par widget est publique.
 *
 * Architecture retenue (contrat PaymentProvider = URL de paiement hébergée) :
 *  - checkout : l'API sert une PAGE-PONT (`GET /payments/intouch/bridge/:id`)
 *    qui charge le script officiel TouchPay et appelle sendPaymentInfos(...)
 *    avec les paramètres injectés côté serveur — même patron que les pages
 *    HTML SAML/LTI déjà servies par l'API ;
 *  - notification : InTouch appelle l'url_notification que NOUS déclarons ;
 *    aucune signature de webhook n'étant documentée publiquement, l'URL porte
 *    un secret (?s=INTOUCH_NOTIFY_SECRET) vérifié à temps constant, et la
 *    notification reste un simple réveil (statut PENDING) ;
 *  - vérité : GET INTOUCH_STATUS_URL (gabarit {orderNumber}, fourni dans le
 *    portail à l'onboarding, basic auth optionnelle). Sans ce gabarit,
 *    fetchStatus répond UNKNOWN et RIEN n'est accordé automatiquement — le
 *    constat manuel et « Re-vérifier » restent les filets.
 */
import { timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { ProviderError, type CheckoutInput, type CheckoutResult, type PaymentProvider, type ProviderStatus, type WebhookVerification } from "./provider.js";

function secretsMatch(expected: string, presented: string): boolean {
  const a = Buffer.from(expected), b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** La route webhook InTouch (GET ou POST) enveloppe requête → { query, body } :
 *  le format de notification variant selon le canal, on lit les deux. Pur, testé. */
export function parseIntouchNotification(rawBody: string): { query: Record<string, string>; fields: Record<string, string> } {
  let query: Record<string, string> = {};
  let bodyRaw = "";
  try {
    const envelope = JSON.parse(rawBody) as { query?: Record<string, unknown>; body?: string };
    query = Object.fromEntries(Object.entries(envelope.query ?? {}).map(([k, v]) => [k, String(v ?? "")]));
    bodyRaw = envelope.body ?? "";
  } catch { bodyRaw = rawBody; }
  let fields: Record<string, string> = {};
  const t = bodyRaw.trim();
  if (t.startsWith("{")) {
    try { fields = Object.fromEntries(Object.entries(JSON.parse(t) as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")])); }
    catch { /* corps illisible → seuls les paramètres d'URL comptent */ }
  } else if (t) {
    fields = Object.fromEntries(new URLSearchParams(t));
  }
  return { query, fields };
}

/** Statuts TouchPay observés → contrat interne. Pur, testé. */
export function mapIntouchStatus(s: string | undefined): ProviderStatus {
  const v = (s ?? "").toUpperCase();
  if (["SUCCESSFUL", "SUCCESS", "PAYMENT_VALIDATION", "VALIDATED", "OK"].includes(v)) return "SUCCEEDED";
  if (["FAILED", "FAILURE", "CANCELLED", "CANCELED", "REFUSED", "EXPIRED", "KO"].includes(v)) return "FAILED";
  if (["PENDING", "INITIATED", "WAITING", "PROCESSING", "IN_PROGRESS"].includes(v)) return "PENDING";
  return "UNKNOWN";
}

export const intouchProvider: PaymentProvider = {
  key: "intouch",

  available() {
    return Boolean(env.INTOUCH_AGENCY_CODE && env.INTOUCH_SECURE_CODE && env.INTOUCH_DOMAIN && env.INTOUCH_NOTIFY_SECRET);
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.available()) {
      throw new ProviderError(409, "provider_unconfigured",
        "InTouch n'est pas configuré (INTOUCH_AGENCY_CODE / INTOUCH_SECURE_CODE / INTOUCH_DOMAIN / INTOUCH_NOTIFY_SECRET) — utilisez le fournisseur « manual » ou basculez de fournisseur.");
    }
    if (input.currency !== "XOF") {
      throw new ProviderError(409, "unsupported_currency",
        `InTouch (TouchPay) encaisse en XOF (zone UEMOA) — devise demandée : ${input.currency}. Proposez le prix XOF ou basculez de fournisseur pour cette devise.`);
    }
    // Le « checkout hébergé » est notre page-pont : elle charge le widget
    // officiel avec les paramètres serveur (voir intouchBridgePage, service).
    return {
      paymentUrl: `${env.PUBLIC_BASE_URL}/api/v1/payments/intouch/bridge/${encodeURIComponent(input.paymentId)}`,
      providerRef: input.paymentId,
    };
  },

  verifyWebhook(_headers, rawBody): WebhookVerification {
    const { query, fields } = parseIntouchNotification(rawBody);
    const secret = env.INTOUCH_NOTIFY_SECRET;
    const presented = query.s ?? "";
    const signatureOk = Boolean(secret && presented && secretsMatch(secret, presented));
    // Notre url_notification porte toujours order_number=<paymentId> — la
    // corrélation ne dépend donc pas du format (variable) du payload InTouch.
    const providerRef = query.order_number || fields.order_number || fields.idFromClient || fields.id_transaction || null;
    const statusRaw = fields.status || fields.payment_status || query.status || "";
    return {
      signatureOk,
      eventId: `${providerRef ?? "?"}:${statusRaw || "notify"}`,
      providerRef,
      // Réveil seulement : la vérité vient de fetchStatus (INTOUCH_STATUS_URL).
      status: "PENDING",
      method: fields.payment_mode || fields.service_id || undefined,
    };
  },

  async fetchStatus(providerRef): Promise<{ status: ProviderStatus; raw?: unknown }> {
    // Sans gabarit d'API de statut (fourni à l'onboarding), aucune vérité
    // automatique — UNKNOWN n'accorde jamais rien (voir handleProviderWebhook).
    if (!this.available() || !env.INTOUCH_STATUS_URL) return { status: "UNKNOWN" };
    const url = env.INTOUCH_STATUS_URL.replace("{orderNumber}", encodeURIComponent(providerRef));
    const headers: Record<string, string> = {};
    if (env.INTOUCH_STATUS_AUTH) headers.authorization = `Basic ${Buffer.from(env.INTOUCH_STATUS_AUTH).toString("base64")}`;
    const res = await fetch(url, { headers })
      .catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `InTouch injoignable : ${e.message}`); });
    const json = await res.json().catch(() => null) as { status?: string; data?: { status?: string } } | null;
    const status = mapIntouchStatus(json?.data?.status ?? json?.status);
    return { status, raw: json };
  },
};
