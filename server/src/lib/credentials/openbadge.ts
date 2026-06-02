/**
 * openbadge.ts — Open Badges document builders (pure).
 *
 * Produces both:
 *   - OB 2.0 hosted Assertion (JSON-LD) — verified by being fetched from a stable
 *     issuer URL; recipient identity is a salted SHA-256 hash (privacy-preserving).
 *   - OB 3.0 credential subject (W3C Verifiable Credentials data model) — signed
 *     downstream as a VC-JWT.
 */
import { env } from "../../config/env.js";

const base = () => env.PUBLIC_BASE_URL.replace(/\/$/, "");

export const issuerId = () => `${base()}/api/v1/credentials/issuer`;
export const credentialUrl = (id: string) => `${base()}/api/v1/credentials/${id}`;
export const badgeClassId = (slug: string, type: string) => `${base()}/api/v1/credentials/badge-class/${slug}/${type}`;

export function issuerDocument() {
  return {
    "@context": "https://w3id.org/openbadges/v2",
    type: "Issuer",
    id: issuerId(),
    name: env.CREDENTIAL_ISSUER_NAME,
    url: env.CREDENTIAL_ISSUER_URL,
  };
}

export type AchievementInput = {
  courseSlug: string;
  type: string; // badge type
  name: string;
  description: string;
  criteria: string[];
  competencies?: { code: string; label: string }[];
};

export function badgeClassDocument(a: AchievementInput) {
  return {
    "@context": "https://w3id.org/openbadges/v2",
    type: "BadgeClass",
    id: badgeClassId(a.courseSlug, a.type),
    name: a.name,
    description: a.description,
    criteria: { narrative: a.criteria.join(" · ") },
    issuer: issuerId(),
    alignment: (a.competencies ?? []).map((c) => ({ targetName: c.label, targetCode: c.code })),
  };
}

/** OB 2.0 hosted Assertion. */
export function hostedAssertion(params: {
  credentialId: string;
  achievement: AchievementInput;
  recipientHash: string;
  recipientSalt: string;
  issuedAt: Date;
  revoked: boolean;
  revocationReason?: string | null;
}) {
  return {
    "@context": "https://w3id.org/openbadges/v2",
    type: "Assertion",
    id: credentialUrl(params.credentialId),
    badge: badgeClassDocument(params.achievement),
    recipient: { type: "email", hashed: true, salt: params.recipientSalt, identity: `sha256$${params.recipientHash}` },
    issuedOn: params.issuedAt.toISOString(),
    verification: { type: "HostedBadge" },
    ...(params.revoked ? { revoked: true, revocationReason: params.revocationReason ?? "revoked" } : {}),
  };
}

/** OB 3.0 / W3C Verifiable Credential body (signed downstream as a VC-JWT). */
export function verifiableCredential(params: {
  credentialId: string;
  achievement: AchievementInput;
  recipientHash: string;
  subjectName: string;
  issuedAt: Date;
}) {
  return {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://purl.imsglobal.org/spec/ob/v3p0/context.json",
    ],
    id: credentialUrl(params.credentialId),
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    issuer: { id: issuerId(), name: env.CREDENTIAL_ISSUER_NAME, url: env.CREDENTIAL_ISSUER_URL },
    issuanceDate: params.issuedAt.toISOString(),
    credentialSubject: {
      type: ["AchievementSubject"],
      identifier: { type: "IdentityObject", hashed: true, identityHash: `sha256$${params.recipientHash}` },
      achievement: {
        id: badgeClassId(params.achievement.courseSlug, params.achievement.type),
        type: ["Achievement"],
        name: params.achievement.name,
        description: params.achievement.description,
        criteria: { narrative: params.achievement.criteria.join(" · ") },
        alignments: (params.achievement.competencies ?? []).map((c) => ({ targetName: c.label, targetCode: c.code })),
      },
    },
  };
}
