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

export type AchievementResult = { score: number | null; max: number; threshold: number; passed: boolean };

export type AchievementInput = {
  courseSlug: string;
  type: string; // badge type
  name: string;
  description: string;
  criteria: string[];
  competencies?: { code: string; label: string }[];
  /// Graded result (Bloc 4 rubric): surfaced as OB2 evidence + OB3 results.
  result?: AchievementResult;
};

function resultNarrative(r: AchievementResult): string {
  const s = r.score == null ? "—" : `${r.score}/${r.max}`;
  return `Évaluation finale par grille : ${s} (seuil de certification ${r.threshold}/${r.max}). ${r.passed ? "Réussi" : "Non atteint"}.`;
}

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
  const r = params.achievement.result;
  return {
    "@context": "https://w3id.org/openbadges/v2",
    type: "Assertion",
    id: credentialUrl(params.credentialId),
    badge: badgeClassDocument(params.achievement),
    recipient: { type: "email", hashed: true, salt: params.recipientSalt, identity: `sha256$${params.recipientHash}` },
    issuedOn: params.issuedAt.toISOString(),
    verification: { type: "HostedBadge" },
    ...(r ? { narrative: resultNarrative(r), evidence: [{ type: "Evidence", narrative: resultNarrative(r) }] } : {}),
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
        ...(params.achievement.result
          ? { resultDescriptions: [{ type: ["ResultDescription"], name: "Score grille D4", requiredValue: String(params.achievement.result.threshold) }] }
          : {}),
      },
      ...(params.achievement.result
        ? { results: [{ type: ["Result"], value: params.achievement.result.score == null ? "" : String(params.achievement.result.score), status: params.achievement.result.passed ? "Completed" : "Failed" }] }
        : {}),
    },
  };
}
