/**
 * provider.ts — contrat commun des fournisseurs de paiement (spec §10).
 *
 * Un seul contrat interne ; CinetPay + plan B (Flutterwave) + `manual`
 * derrière, un seul actif à la fois (réglage Super Admin), bascule sans
 * redéploiement. Chaque Paiement mémorise SON fournisseur : un paiement
 * engagé se confirme (webhook) et se réconcilie (fetchStatus) sur lui,
 * même après bascule.
 */
import type { Currency } from "../../domain/payments/money.js";

export type ProviderKey = "cinetpay" | "flutterwave" | "manual";

export type CheckoutInput = {
  /** Notre identifiant de Paiement — devient la référence de transaction chez
   *  le fournisseur (transaction_id CinetPay, tx_ref Flutterwave). */
  paymentId: string;
  amountMinor: number;
  currency: Currency;
  description: string;
  returnUrl: string;
  customer?: { email?: string; name?: string };
};

export type CheckoutResult = {
  /** Page de paiement hébergée du fournisseur — null pour `manual`. */
  paymentUrl: string | null;
  providerRef: string;
  /** `manual` : références de virement à afficher à l'acheteur. */
  instructions?: string;
};

export type ProviderStatus = "SUCCEEDED" | "FAILED" | "PENDING" | "UNKNOWN";

export type WebhookVerification = {
  signatureOk: boolean;
  /** Clé d'idempotence de l'événement, unique par fournisseur. */
  eventId: string;
  /** Référence de transaction retrouvée dans le payload (= notre paymentId). */
  providerRef: string | null;
  /** Statut annoncé par le webhook — TOUJOURS contre-vérifié par fetchStatus
   *  avant d'accorder quoi que ce soit (règle « le webhook fait foi, mais
   *  vérifié deux fois » ; pour CinetPay la doc l'exige explicitement). */
  status: ProviderStatus;
  amountMinor?: number;
  currency?: string;
  method?: string;
  reason?: string;
};

export interface PaymentProvider {
  readonly key: ProviderKey;
  /** Configuration présente ? Un fournisseur non configuré reste listé dans le
   *  registre mais refuse proprement le checkout. */
  available(): boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Vérifie la signature sur le CORPS BRUT et normalise l'événement. */
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookVerification | Promise<WebhookVerification>;
  /** Interroge le fournisseur — contre-vérification des webhooks + job de
   *  réconciliation des paiements restés sans callback. */
  fetchStatus(providerRef: string): Promise<{ status: ProviderStatus; raw?: unknown }>;
}

export class ProviderError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

/** En-tête HTTP normalisé (Fastify livre string | string[] | undefined). */
export function headerValue(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const v = headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}
