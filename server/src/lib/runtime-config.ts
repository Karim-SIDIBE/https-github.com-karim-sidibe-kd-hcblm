/**
 * runtime-config.ts — configuration d'EXPLOITATION modifiable depuis la
 * console Super Admin, effective immédiatement, sans redéploiement.
 *
 * Deux sources alimentent un cache mémoire à lecture SYNCHRONE (les
 * adaptateurs de paiement et l'émetteur Open Badges lisent en synchrone) :
 *  - IntegrationSecret : clés d'agrégateurs de paiement, CHIFFRÉES au repos
 *    (lib/crypto/field, AES-256-GCM). La valeur console PRIME ; la variable
 *    d'environnement homonyme reste le repli — un déploiement configuré par
 *    deploy/.env continue de fonctionner à l'identique.
 *  - Setting (credential_issuer_name / credential_issuer_url) : l'émetteur
 *    des certificats, imprimé sur les badges, les VC et les pages publiques.
 *
 * Chargé au boot (app.ts), rafraîchi à chaque écriture console dans CE
 * processus, et rechargé paresseusement toutes les 60 s — couvre les
 * déploiements à plusieurs workers (API_WORKERS > 1) avec au pire une minute
 * de décalage sur les workers voisins.
 */
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { decryptField, encryptField } from "./crypto/field.js";

export type ProviderFieldDef = { key: string; label: string; secret: boolean };

/** Champs configurables en console, par agrégateur (clé = variable d'env
 *  homonyme — c'est ce qui rend le repli .env automatique). */
export const PROVIDER_CONFIG_FIELDS: Record<string, ProviderFieldDef[]> = {
  cinetpay: [
    { key: "CINETPAY_API_KEY", label: "API key", secret: true },
    { key: "CINETPAY_SITE_ID", label: "Site ID", secret: false },
    { key: "CINETPAY_SECRET_KEY", label: "Secret key (webhook)", secret: true },
  ],
  flutterwave: [
    { key: "FLUTTERWAVE_SECRET_KEY", label: "Secret key", secret: true },
    { key: "FLUTTERWAVE_WEBHOOK_HASH", label: "Webhook hash", secret: true },
  ],
  paydunya: [
    { key: "PAYDUNYA_MASTER_KEY", label: "Master key", secret: true },
    { key: "PAYDUNYA_PRIVATE_KEY", label: "Private key", secret: true },
    { key: "PAYDUNYA_TOKEN", label: "Token", secret: true },
  ],
  intouch: [
    { key: "INTOUCH_AGENCY_CODE", label: "Code agence", secret: false },
    { key: "INTOUCH_SECURE_CODE", label: "Code sécurisé", secret: true },
    { key: "INTOUCH_DOMAIN", label: "Domaine", secret: false },
    { key: "INTOUCH_NOTIFY_SECRET", label: "Secret de notification", secret: true },
    { key: "INTOUCH_STATUS_URL", label: "URL de statut", secret: false },
    { key: "INTOUCH_STATUS_AUTH", label: "Auth. statut (user:pass)", secret: true },
  ],
  jeko: [
    { key: "JEKO_API_KEY", label: "API key", secret: true },
    { key: "JEKO_API_KEY_ID", label: "API key ID", secret: false },
    { key: "JEKO_STORE_ID", label: "Store ID (UUID du magasin)", secret: false },
    { key: "JEKO_WEBHOOK_SECRET", label: "Secret du webhook", secret: true },
  ],
};

const KNOWN_SECRET_KEYS = new Set(Object.values(PROVIDER_CONFIG_FIELDS).flat().map((f) => f.key));

const ISSUER_KEYS = ["credential_issuer_name", "credential_issuer_url"] as const;
type IssuerKey = (typeof ISSUER_KEYS)[number];

const secrets = new Map<string, string>();
const issuer = new Map<string, string>();
let lastLoad = 0;
let loading: Promise<void> | null = null;

/** (Re)charge tout le cache depuis la base. Appelé au boot puis à la demande. */
export async function loadRuntimeConfig(): Promise<void> {
  const [rows, settings] = await Promise.all([
    prisma.integrationSecret.findMany(),
    prisma.setting.findMany({ where: { key: { in: [...ISSUER_KEYS] } } }),
  ]);
  secrets.clear();
  for (const r of rows) {
    // Clé de chiffrement changée → valeur illisible : on l'ignore (l'env
    // reprend la main) plutôt que d'empêcher l'API de démarrer.
    try { secrets.set(r.key, decryptField(r.value)); } catch { /* voir ci-dessus */ }
  }
  issuer.clear();
  for (const s of settings) {
    if (typeof s.value === "string" && s.value.trim()) issuer.set(s.key, s.value.trim());
  }
  lastLoad = Date.now();
}

function lazyRefresh() {
  if (Date.now() - lastLoad > 60_000 && !loading) {
    loading = loadRuntimeConfig().catch(() => {}).finally(() => { loading = null; });
  }
}

/** Valeur EFFECTIVE d'une clé d'intégration : console d'abord, env en repli. */
export function integrationValue(key: string): string | undefined {
  lazyRefresh();
  return secrets.get(key) ?? ((env as unknown as Record<string, string | undefined>)[key] || undefined);
}

/** D'où vient la valeur effective (pour l'écran de configuration). */
export function integrationSource(key: string): "console" | "env" | null {
  lazyRefresh();
  if (secrets.has(key)) return "console";
  return (env as unknown as Record<string, string | undefined>)[key] ? "env" : null;
}

/** Écrit (valeur) ou retire (null) des clés console — chiffrées au repos.
 *  L'audit est de la responsabilité de l'appelant (jamais les valeurs). */
export async function setIntegrationSecrets(entries: Record<string, string | null>, actorId?: string): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    if (!KNOWN_SECRET_KEYS.has(key)) throw new Error(`Clé d'intégration inconnue : ${key}`);
    if (value === null) {
      await prisma.integrationSecret.deleteMany({ where: { key } });
      secrets.delete(key);
    } else {
      const stored = encryptField(value);
      await prisma.integrationSecret.upsert({
        where: { key },
        create: { key, value: stored, updatedById: actorId ?? null },
        update: { value: stored, updatedById: actorId ?? null },
      });
      secrets.set(key, value);
    }
  }
}

// --- émetteur des certificats ----------------------------------------------

export function issuerName(): string {
  lazyRefresh();
  return issuer.get("credential_issuer_name") ?? env.CREDENTIAL_ISSUER_NAME;
}
export function issuerUrl(): string {
  lazyRefresh();
  return issuer.get("credential_issuer_url") ?? env.CREDENTIAL_ISSUER_URL;
}
/** Répercute une écriture de réglage émetteur dans le cache de CE processus. */
export function setIssuerOverride(key: IssuerKey, value: string): void {
  if (value.trim()) issuer.set(key, value.trim());
  else issuer.delete(key);
}
