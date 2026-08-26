/**
 * manual.ts — le fournisseur « constat staff » : virements B2B, ventes
 * hors-ligne, développement & tests. Toujours disponible. Il n'émet pas de
 * page de paiement : le checkout renvoie les références de virement à
 * rappeler, et c'est l'action staff « constater le paiement » (auditée,
 * idempotente) qui joue le rôle du webhook — mêmes droits, même facture.
 */
import type { CheckoutInput, CheckoutResult, PaymentProvider, ProviderStatus, WebhookVerification } from "./provider.js";
import { formatAmount } from "../../domain/payments/money.js";

export const manualProvider: PaymentProvider = {
  key: "manual",

  available() { return true; },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    return {
      paymentUrl: null,
      providerRef: input.paymentId,
      instructions: `Règlement par virement : ${formatAmount(input.amountMinor, input.currency)} — rappelez impérativement la référence « ${input.paymentId} » dans le libellé du virement. L'accès est débloqué dès constat de la réception par nos équipes.`,
    };
  },

  // Pas de webhook pour `manual` : le constat staff passe par l'API admin.
  verifyWebhook(): WebhookVerification {
    return { signatureOk: false, eventId: "manual", providerRef: null, status: "UNKNOWN", reason: "Le fournisseur manual ne reçoit pas de webhooks" };
  },

  async fetchStatus(): Promise<{ status: ProviderStatus }> {
    return { status: "UNKNOWN" };
  },
};
