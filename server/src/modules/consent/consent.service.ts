/**
 * consent.service.ts — persistence for the RGPD consent ledger. Append-only
 * grants; revoking stamps `revokedAt`. The pure state machine lives in
 * domain/consent.ts.
 */
import { prisma } from "../../db/prisma.js";
import { audit } from "../../lib/audit.js";
import { CONSENT_POLICIES, currentConsentState, type ConsentType } from "../../domain/consent.js";

/** Current consent state per policy for a user. */
export async function listConsents(userId: string) {
  const rows = await prisma.consent.findMany({ where: { userId }, select: { type: true, version: true, grantedAt: true, revokedAt: true } });
  return currentConsentState(rows);
}

/** Grant or revoke one consent at the current policy version. Idempotent. */
export async function setConsent(userId: string, type: ConsentType, granted: boolean, ip?: string) {
  const version = CONSENT_POLICIES[type].version;
  const active = await prisma.consent.findFirst({ where: { userId, type, revokedAt: null }, orderBy: { grantedAt: "desc" } });

  if (granted) {
    if (active && active.version === version) return { type, granted: true }; // already current
    if (active) await prisma.consent.update({ where: { id: active.id }, data: { revokedAt: new Date() } });
    await prisma.consent.create({ data: { userId, type, version, ip } });
  } else {
    if (active) await prisma.consent.update({ where: { id: active.id }, data: { revokedAt: new Date() } });
  }
  await audit({ actorId: userId, action: granted ? "consent.granted" : "consent.revoked", ip, meta: { type, version } });
  return { type, granted };
}

/** Capture consents at B2C registration: terms + privacy are required, marketing optional. */
export async function recordRegistrationConsents(userId: string, marketingOptIn: boolean, ip?: string) {
  const types: ConsentType[] = marketingOptIn ? ["terms", "privacy", "marketing"] : ["terms", "privacy"];
  await prisma.consent.createMany({ data: types.map((type) => ({ userId, type, version: CONSENT_POLICIES[type].version, ip })) });
}
