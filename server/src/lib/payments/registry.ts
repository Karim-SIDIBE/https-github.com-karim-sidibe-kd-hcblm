/**
 * registry.ts — registre bi-fournisseur (spec §09) : CinetPay + plan B
 * (Flutterwave) + `manual`, un seul ACTIF pour les nouveaux checkouts.
 * L'actif est un réglage (magasin de réglages, bascule Super Admin sans
 * redéploiement) ; les webhooks des DEUX agrégateurs restent toujours
 * acceptés — un paiement engagé se termine sur son fournisseur d'origine.
 */
import type { PaymentProviderId } from "../../generated/prisma/client.js";
import { getSetting } from "../../modules/settings/settings.routes.js";
import { cinetpayProvider } from "./cinetpay.js";
import { flutterwaveProvider } from "./flutterwave.js";
import { manualProvider } from "./manual.js";
import type { PaymentProvider, ProviderKey } from "./provider.js";

export const PROVIDERS: Record<ProviderKey, PaymentProvider> = {
  cinetpay: cinetpayProvider,
  flutterwave: flutterwaveProvider,
  manual: manualProvider,
};

/** Clé de registre ↔ enum Prisma porté par chaque Paiement. */
export const PROVIDER_ENUM: Record<ProviderKey, PaymentProviderId> = {
  cinetpay: "CINETPAY", flutterwave: "FLUTTERWAVE", manual: "MANUAL",
};
export function providerKeyOf(id: PaymentProviderId): ProviderKey {
  return id.toLowerCase() as ProviderKey;
}

/** Le fournisseur actif pour les NOUVEAUX checkouts (réglage `payment_provider`,
 *  défaut `manual` — la plateforme fonctionne sans aucun compte marchand). */
export async function getActiveProvider(): Promise<PaymentProvider> {
  const key = await getSetting<ProviderKey>("payment_provider");
  return PROVIDERS[key] ?? manualProvider;
}
