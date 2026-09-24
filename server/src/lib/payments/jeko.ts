/**
 * jeko.ts — adaptateur Jèko (Partner API, Côte d'Ivoire), écrit contre la
 * documentation officielle (developer.jeko.africa, transcrite le 24/09/2026) :
 *  - initialisation : POST {base}/partner_api/payment_requests (en-têtes
 *    X-API-KEY / X-API-KEY-ID ; corps storeId, amountCents en CENTIMES de XOF
 *    — 1 XOF = 100 centimes, multiple de 100 —, reference 5-100 caractères,
 *    paymentDetails.type "redirect" + paymentMethod/successUrl/errorUrl)
 *    → { id, status: "pending", redirectUrl } ;
 *  - webhook : POST « TRANSACTION_COMPLETED », corps = la transaction À PLAT
 *    (pas d'enveloppe), signé par l'en-tête `Jeko-Signature` = HMAC-SHA256 du
 *    CORPS BRUT avec le secret webhook, hex minuscule sans préfixe. Les autres
 *    événements (enveloppe { event, payload }) sont écartés proprement.
 *    ⚠️ Un PAIEMENT ÉCHOUÉ ne déclenche AUCUN webhook : la détection des
 *    échecs repose sur fetchStatus (« Re-vérifier » + réconciliation) ;
 *  - vérité : GET {base}/partner_api/payment_requests/{id} → status
 *    pending | success | error.
 *
 * Particularités tenues ici :
 *  - le moyen de paiement (wave/orange/mtn/moov/djamo) est EXIGÉ à la création
 *    → l'écran d'achat le fait choisir (checkoutMethods) ;
 *  - une référence est CONSOMMÉE par tentative (rejouer la même → 409
 *    payment_request_exists_with_reference) → référence suffixée par tentative,
 *    `<paymentId>-<suffixe>` ; la corrélation nominale passe par l'id de la
 *    demande (providerRef), le préfixe de la référence sert de secours ;
 *  - Jèko encaisse en XOF uniquement ; pas de sandbox (magasin de test dédié).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { ProviderError, headerValue, type CheckoutInput, type CheckoutResult, type PaymentProvider, type ProviderStatus, type WebhookVerification } from "./provider.js";

const BASE = () => env.JEKO_BASE_URL;

const KEY_HEADERS = () => ({
  "X-API-KEY": env.JEKO_API_KEY ?? "",
  "X-API-KEY-ID": env.JEKO_API_KEY_ID ?? "",
});

/** Moyens acceptés par payment_requests (doc « Les trois produits »). */
export const JEKO_METHODS = ["wave", "orange", "mtn", "moov", "djamo"] as const;

/** XOF (unité mineure = franc) → centimes Jèko. Multiple de 100 par construction. */
export function toJekoCents(amountMinor: number): number {
  return amountMinor * 100;
}

/** Centimes Jèko → notre unité mineure XOF (null si le montant n'est pas un
 *  nombre entier de francs — il serait alors incomparable, jamais « proche »). */
export function fromJekoCents(amountCents: unknown): number | null {
  if (typeof amountCents !== "number" || !Number.isSafeInteger(amountCents)) return null;
  return amountCents % 100 === 0 ? amountCents / 100 : null;
}

/** Signature attendue : HMAC-SHA256 du corps brut, hex minuscule. Pur, testé. */
export function expectedJekoSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/** Comparaison à temps constant (longueurs d'abord — patron cinetpay.ts). */
export function jekoSignaturesMatch(expected: string, presented: string): boolean {
  const a = Buffer.from(expected.toLowerCase()), b = Buffer.from(presented.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Référence de tentative : `<paymentId>-<horodatage base36>` (5-100 caractères,
 *  unique par tentative — la doc l'exige : « une référence par tentative, pas
 *  une par commande »). Pur, testé. */
export function jekoReference(paymentId: string, now = Date.now()): string {
  return `${paymentId}-${now.toString(36)}`;
}

/** paymentId retrouvé depuis une référence de tentative (secours de corrélation
 *  — un cuid ne contient pas de tiret). Pur, testé. */
export function paymentIdOfReference(reference: string): string {
  return reference.split("-")[0] ?? reference;
}

// --- Liens de paiement (lot 2 — factures B2B partagées par WhatsApp/e-mail) ---

/** Un lien de paiement n'a PAS de statut chez Jèko (seulement
 *  canReceivePayments) et son identifiant vit dans un espace distinct des
 *  demandes de paiement : providerRef préfixé pour router fetchStatus. */
export const JEKO_LINK_PREFIX = "pl:";
export function linkRefOf(linkId: string): string { return `${JEKO_LINK_PREFIX}${linkId}`; }
export function linkIdOf(providerRef: string): string | null {
  return providerRef.startsWith(JEKO_LINK_PREFIX) ? providerRef.slice(JEKO_LINK_PREFIX.length) : null;
}

/** Statut d'un lien À USAGE UNIQUE (doc « Vérifier si un paiement a été
 *  complété ») : fermé = payé. ⚠️ Un lien expiré ou désactivé est fermé
 *  aussi — cette lecture ne sert donc jamais seule à régler : le webhook
 *  TRANSACTION_COMPLETED reste le déclencheur nominal, et « Re-vérifier »
 *  est une action staff délibérée. Pur, testé. */
export function linkStatusOf(link: { allowMultiplePayments?: boolean; canReceivePayments?: boolean } | null): ProviderStatus {
  if (!link || typeof link.canReceivePayments !== "boolean") return "UNKNOWN";
  if (link.allowMultiplePayments) return "UNKNOWN"; // réutilisable : indécidable par ce champ
  return link.canReceivePayments ? "PENDING" : "SUCCEEDED";
}

/** Crée un lien de paiement Jèko À USAGE UNIQUE (titre 10-255, minimum
 *  10 000 centimes = 100 XOF — doc « Liens de paiement »). */
export async function createJekoPaymentLink(input: { title: string; amountMinor: number; currency: string }): Promise<{ linkId: string; url: string }> {
  if (!jekoProvider.available()) {
    throw new ProviderError(409, "provider_unconfigured",
      "Jèko n'est pas configuré (JEKO_API_KEY / JEKO_API_KEY_ID / JEKO_STORE_ID / JEKO_WEBHOOK_SECRET) — le lien de paiement sera disponible dès la configuration.");
  }
  if (input.currency !== "XOF") {
    throw new ProviderError(409, "unsupported_currency", `Les liens de paiement Jèko encaissent en XOF — devise demandée : ${input.currency}.`);
  }
  if (input.amountMinor < 100) {
    throw new ProviderError(422, "amount_too_small", "Un lien de paiement Jèko exige 100 F CFA minimum.");
  }
  const title = input.title.length >= 10 ? input.title.slice(0, 255) : input.title.padEnd(10, "·");
  const res = await fetch(`${BASE()}/partner_api/payment_links`, {
    method: "POST",
    headers: { "content-type": "application/json", ...KEY_HEADERS() },
    body: JSON.stringify({
      storeId: env.JEKO_STORE_ID,
      title,
      amountCents: toJekoCents(input.amountMinor),
      currency: "XOF",
      allowMultiplePayments: false,
    }),
  }).catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `Jèko injoignable : ${e.message}`); });
  const json = await res.json().catch(() => null) as { id?: string; link?: string; message?: string } | null;
  if (!res.ok || !json?.id || !json.link) {
    throw new ProviderError(502, "link_failed", `Jèko a refusé la création du lien (HTTP ${res.status}${json?.message ? ` · ${json.message}` : ""})`);
  }
  return { linkId: json.id, url: json.link };
}

/** Relit un lien (URL + disponibilité) — pour réutiliser un lien encore ouvert
 *  plutôt que d'en semer un nouveau à chaque clic. */
export async function fetchJekoPaymentLink(linkId: string): Promise<{ url: string; canReceivePayments: boolean } | null> {
  if (!jekoProvider.available()) return null;
  const res = await fetch(`${BASE()}/partner_api/payment_links/${encodeURIComponent(linkId)}`, { headers: KEY_HEADERS() })
    .catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `Jèko injoignable : ${e.message}`); });
  const json = await res.json().catch(() => null) as { link?: string; canReceivePayments?: boolean } | null;
  if (!res.ok || !json?.link) return null;
  return { url: json.link, canReceivePayments: json.canReceivePayments === true };
}

type JekoTransaction = {
  id?: string;
  status?: string;
  amount?: { amount?: number; currency?: string };
  paymentMethod?: string;
  transactionType?: string;
  transactionDetails?: { id?: string; reference?: string; paymentLinkId?: string };
  event?: string; // présent uniquement sur les événements en enveloppe (non-transaction)
};

/** Statut Jèko (pending | success | error) → statut du contrat. Pur, testé. */
export function mapJekoStatus(status: string | undefined): ProviderStatus {
  const s = status?.toLowerCase();
  if (s === "success") return "SUCCEEDED";
  if (s === "error") return "FAILED";
  if (s === "pending") return "PENDING";
  return "UNKNOWN";
}

export const jekoProvider: PaymentProvider = {
  key: "jeko",
  checkoutMethods: JEKO_METHODS,

  available() {
    return Boolean(env.JEKO_API_KEY && env.JEKO_API_KEY_ID && env.JEKO_STORE_ID && env.JEKO_WEBHOOK_SECRET);
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.available()) {
      throw new ProviderError(409, "provider_unconfigured",
        "Jèko n'est pas configuré (JEKO_API_KEY / JEKO_API_KEY_ID / JEKO_STORE_ID / JEKO_WEBHOOK_SECRET) — utilisez le fournisseur « manual » ou basculez de fournisseur.");
    }
    if (input.currency !== "XOF") {
      throw new ProviderError(409, "unsupported_currency",
        `Jèko encaisse en XOF (Côte d'Ivoire) — devise demandée : ${input.currency}. Proposez le prix XOF ou basculez de fournisseur pour cette devise.`);
    }
    const method = input.method?.toLowerCase();
    if (!method || !(JEKO_METHODS as readonly string[]).includes(method)) {
      throw new ProviderError(422, "method_required",
        `Jèko exige le moyen de paiement à la création — choisissez parmi : ${JEKO_METHODS.join(", ")}.`);
    }
    // Une référence PAR TENTATIVE : un échec d'initialisation consomme la
    // référence chez Jèko (409 payment_request_exists_with_reference).
    const reference = jekoReference(input.paymentId);
    const res = await fetch(`${BASE()}/partner_api/payment_requests`, {
      method: "POST",
      headers: { "content-type": "application/json", ...KEY_HEADERS() },
      body: JSON.stringify({
        storeId: env.JEKO_STORE_ID,
        amountCents: toJekoCents(input.amountMinor),
        currency: "XOF",
        reference,
        paymentDetails: {
          type: "redirect",
          data: {
            paymentMethod: method,
            successUrl: input.returnUrl,
            errorUrl: input.returnUrl,
          },
        },
      }),
    }).catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `Jèko injoignable : ${e.message}`); });
    const json = await res.json().catch(() => null) as { id?: string; status?: string; redirectUrl?: string; message?: string } | null;
    if (!res.ok || !json?.id || !json.redirectUrl) {
      throw new ProviderError(502, "checkout_failed",
        `Jèko a refusé l'initialisation (HTTP ${res.status}${json?.message ? ` · ${json.message}` : ""})`);
    }
    // L'ID de la demande de paiement est la référence fournisseur : c'est lui
    // que l'endpoint de statut attend, et lui que le webhook rappelle dans
    // transactionDetails.id.
    return { paymentUrl: json.redirectUrl, providerRef: json.id };
  },

  verifyWebhook(headers, rawBody): WebhookVerification {
    const presented = headerValue(headers, "jeko-signature");
    const secret = env.JEKO_WEBHOOK_SECRET;
    const signatureOk = Boolean(secret && presented && jekoSignaturesMatch(expectedJekoSignature(rawBody, secret), presented));

    let body: JekoTransaction | null = null;
    try { body = JSON.parse(rawBody) as JekoTransaction; } catch { /* corps illisible → non corrélé */ }

    // Événements en enveloppe (SERVICE_PROVIDER_LINK_REQUEST…) : signés mais
    // hors périmètre paiement — providerRef null, le service les journalise
    // « ignorés » sans consommer de règlement.
    if (!body || typeof body.event === "string") {
      return { signatureOk, eventId: `event:${body?.event ?? "unreadable"}:${Date.now().toString(36)}`, providerRef: null, status: "UNKNOWN" };
    }

    const amountMinor = body.amount ? fromJekoCents(body.amount.amount) : null;
    return {
      signatureOk,
      // L'id de transaction Jèko est la clé d'idempotence documentée.
      eventId: body.id ?? `notify:${Date.now().toString(36)}`,
      // Corrélation : un paiement de LIEN porte paymentLinkId (providerRef
      // stocké « pl:<id> ») ; sinon l'id de la demande (= providerRef du
      // checkout) ; secours : le préfixe paymentId de notre référence.
      providerRef: (body.transactionDetails?.paymentLinkId ? linkRefOf(body.transactionDetails.paymentLinkId) : null)
        ?? body.transactionDetails?.id
        ?? (body.transactionDetails?.reference ? paymentIdOfReference(body.transactionDetails.reference) : null),
      // Le statut annoncé n'accorde rien : le service contre-vérifie toujours
      // par fetchStatus avant tout règlement.
      status: mapJekoStatus(body.status),
      ...(amountMinor !== null ? { amountMinor } : {}),
      ...(body.amount?.currency ? { currency: body.amount.currency } : {}),
      method: body.paymentMethod || undefined,
    };
  },

  async fetchStatus(providerRef): Promise<{ status: ProviderStatus; raw?: unknown }> {
    if (!this.available()) return { status: "UNKNOWN" };
    // Lien de paiement (« pl:<id> ») : la disponibilité tient lieu de statut
    // (usage unique : fermé = payé — voir la réserve de linkStatusOf).
    const linkId = linkIdOf(providerRef);
    if (linkId) {
      const res = await fetch(`${BASE()}/partner_api/payment_links/${encodeURIComponent(linkId)}`, { headers: KEY_HEADERS() })
        .catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `Jèko injoignable : ${e.message}`); });
      if (res.status === 404) return { status: "UNKNOWN", raw: "payment_link_not_found" };
      const json = await res.json().catch(() => null) as { allowMultiplePayments?: boolean; canReceivePayments?: boolean } | null;
      if (!res.ok || !json) return { status: "UNKNOWN", raw: json ?? `HTTP ${res.status}` };
      return { status: linkStatusOf(json), raw: json };
    }
    const res = await fetch(`${BASE()}/partner_api/payment_requests/${encodeURIComponent(providerRef)}`, {
      headers: KEY_HEADERS(),
    }).catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `Jèko injoignable : ${e.message}`); });
    if (res.status === 404) return { status: "UNKNOWN", raw: "payment_request_not_found" };
    const json = await res.json().catch(() => null) as { status?: string } | null;
    if (!res.ok || !json) return { status: "UNKNOWN", raw: json ?? `HTTP ${res.status}` };
    return { status: mapJekoStatus(json.status), raw: json };
  },
};
