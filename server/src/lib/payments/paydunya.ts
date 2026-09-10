/**
 * paydunya.ts — adaptateur PayDunya (Dunya Digital Payment, EDP BCEAO), écrit
 * contre la documentation officielle (developers.paydunya.com, HTTP/JSON,
 * vérifiée le 10/09/2026) :
 *  - initialisation : POST {base}/checkout-invoice/create (en-têtes
 *    PAYDUNYA-MASTER-KEY / PAYDUNYA-PRIVATE-KEY / PAYDUNYA-TOKEN ; corps
 *    invoice.total_amount en XOF, actions.callback_url/return_url,
 *    custom_data.payment_id = notre identifiant) → { response_code: "00",
 *    token, response_text: URL de la page de paiement } ;
 *  - IPN : POST x-www-form-urlencoded imbriqué à la PHP (data[status],
 *    data[invoice][token], data[hash]…) ; data[hash] = SHA-512 hex de la
 *    MASTER KEY — preuve d'origine par secret partagé, PAS une signature du
 *    payload : l'IPN n'est donc qu'un réveil (statut PENDING), la vérité vient
 *    du confirm ;
 *  - vérité : GET {base}/checkout-invoice/confirm/{token} → status
 *    completed | pending | cancelled.
 *
 * PayDunya encaisse en XOF (compte UEMOA) : toute autre devise est refusée
 * proprement au checkout. La finalisation (montants réels, IPN sandbox) se
 * valide à la réception des clés marchand — d'ici là `available()` reste faux.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { toAmountMajor } from "../../domain/payments/money.js";
import { ProviderError, type CheckoutInput, type CheckoutResult, type PaymentProvider, type ProviderStatus, type WebhookVerification } from "./provider.js";

const BASE = () => env.PAYDUNYA_BASE_URL;

const KEY_HEADERS = () => ({
  "PAYDUNYA-MASTER-KEY": env.PAYDUNYA_MASTER_KEY ?? "",
  "PAYDUNYA-PRIVATE-KEY": env.PAYDUNYA_PRIVATE_KEY ?? "",
  "PAYDUNYA-TOKEN": env.PAYDUNYA_TOKEN ?? "",
});

/** data[hash] attendu dans l'IPN : SHA-512 hex de la MASTER KEY. Pur, testé. */
export function expectedPaydunyaHash(masterKey: string): string {
  return createHash("sha512").update(masterKey).digest("hex");
}

/** Comparaison à temps constant (longueurs d'abord — patron cinetpay.ts). */
export function paydunyaHashesMatch(expected: string, presented: string): boolean {
  const a = Buffer.from(expected.toLowerCase()), b = Buffer.from(presented.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Corps IPN : formulaire imbriqué à la PHP (`data[invoice][token]=…`) — mis à
 *  plat en clés pointées (`invoice.token`). Tolère aussi un corps JSON. Pur, testé. */
export function parsePaydunyaIpn(rawBody: string): Record<string, string> {
  const t = rawBody.trim();
  if (t.startsWith("{")) {
    try {
      const flat: Record<string, string> = {};
      const walk = (obj: unknown, prefix: string) => {
        if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) walk(v, prefix ? `${prefix}.${k}` : k);
        } else flat[prefix] = String(obj ?? "");
      };
      walk(JSON.parse(t) as unknown, "");
      // L'enveloppe JSON éventuelle porte la même racine `data` que le formulaire.
      return flat;
    } catch { /* retombe sur le format formulaire */ }
  }
  const flat: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(t)) {
    // `data[invoice][token]` → `data.invoice.token`
    flat[key.replace(/\[([^\]]*)\]/g, ".$1")] = value;
  }
  return flat;
}

export const paydunyaProvider: PaymentProvider = {
  key: "paydunya",

  available() {
    return Boolean(env.PAYDUNYA_MASTER_KEY && env.PAYDUNYA_PRIVATE_KEY && env.PAYDUNYA_TOKEN);
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.available()) {
      throw new ProviderError(409, "provider_unconfigured",
        "PayDunya n'est pas configuré (PAYDUNYA_MASTER_KEY / PAYDUNYA_PRIVATE_KEY / PAYDUNYA_TOKEN) — utilisez le fournisseur « manual » ou basculez de fournisseur.");
    }
    if (input.currency !== "XOF") {
      throw new ProviderError(409, "unsupported_currency",
        `PayDunya encaisse en XOF (zone UEMOA) — devise demandée : ${input.currency}. Proposez le prix XOF ou basculez de fournisseur pour cette devise.`);
    }
    const res = await fetch(`${BASE()}/checkout-invoice/create`, {
      method: "POST",
      headers: { "content-type": "application/json", ...KEY_HEADERS() },
      body: JSON.stringify({
        invoice: { total_amount: toAmountMajor(input.amountMinor, input.currency), description: input.description },
        store: { name: "DECLICK DIGITAL" },
        actions: {
          callback_url: `${env.PUBLIC_BASE_URL}/api/v1/payments/webhooks/paydunya`,
          return_url: input.returnUrl,
          cancel_url: input.returnUrl,
        },
        // Corrélation de secours côté IPN — la corrélation nominale passe par
        // le token de facture (providerRef).
        custom_data: { payment_id: input.paymentId },
      }),
    }).catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `PayDunya injoignable : ${e.message}`); });
    const json = await res.json().catch(() => null) as { response_code?: string; response_text?: string; description?: string; token?: string } | null;
    if (!res.ok || json?.response_code !== "00" || !json.token) {
      throw new ProviderError(502, "checkout_failed",
        `PayDunya a refusé l'initialisation (HTTP ${res.status} · ${json?.response_code ?? "?"} ${json?.response_text ?? json?.description ?? ""})`.trim());
    }
    // response_text porte l'URL de la page de paiement hébergée ; repli :
    // l'URL canonique construite depuis le token.
    const url = json.response_text?.startsWith("http") ? json.response_text : `https://paydunya.com/checkout/invoice/${json.token}`;
    // Le TOKEN est la référence fournisseur : c'est lui (pas notre paymentId)
    // que le endpoint de confirmation attend.
    return { paymentUrl: url, providerRef: json.token };
  },

  verifyWebhook(_headers, rawBody): WebhookVerification {
    const f = parsePaydunyaIpn(rawBody);
    const token = f["data.invoice.token"] || f["data.token"] || null;
    const statusRaw = f["data.status"] ?? "";
    const presented = f["data.hash"] ?? "";
    const master = env.PAYDUNYA_MASTER_KEY;
    const signatureOk = Boolean(master && presented && paydunyaHashesMatch(expectedPaydunyaHash(master), presented));
    return {
      signatureOk,
      eventId: `${token ?? "?"}:${statusRaw || "notify"}`,
      // La corrélation service se fait par providerRef stocké = token de facture.
      providerRef: token,
      // Le hash prouve l'origine mais ne signe pas le payload : l'IPN reste un
      // réveil — statut PENDING pour forcer la contre-vérification `confirm`.
      status: "PENDING",
      method: f["data.customer.payment_method"] || undefined,
    };
  },

  async fetchStatus(providerRef): Promise<{ status: ProviderStatus; raw?: unknown }> {
    if (!this.available()) return { status: "UNKNOWN" };
    const res = await fetch(`${BASE()}/checkout-invoice/confirm/${encodeURIComponent(providerRef)}`, {
      headers: KEY_HEADERS(),
    }).catch((e: Error) => { throw new ProviderError(502, "provider_unreachable", `PayDunya injoignable : ${e.message}`); });
    const json = await res.json().catch(() => null) as { status?: string } | null;
    const s = json?.status?.toLowerCase();
    if (s === "completed") return { status: "SUCCEEDED", raw: json };
    if (s === "cancelled" || s === "canceled" || s === "failed") return { status: "FAILED", raw: json };
    if (s === "pending") return { status: "PENDING", raw: json };
    return { status: "UNKNOWN", raw: json };
  },
};
