/**
 * credentials.service.ts — issue, verify, revoke verifiable credentials.
 *
 * On badge issuance the platform mints both an OB 2.0 hosted assertion and an
 * OB 3.0 Verifiable Credential signed as a VC-JWT (ES256, same keys as auth →
 * verifiable via the public JWKS). Verification checks the signature, the issuer
 * and the revocation status.
 */
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { getKeys, JWT_ALG } from "../../lib/auth/keys.js";
import {
  hostedAssertion, verifiableCredential, issuerId, credentialUrl, type AchievementInput,
} from "../../lib/credentials/openbadge.js";
import { certificatePdf } from "../../lib/credentials/pdf.js";
import { badgeTypeForBlock } from "../../domain/engine/badges.js";
import type { CourseContent, Block } from "../../domain/content-model.js";

export class CredentialError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function achievementFor(content: CourseContent, courseSlug: string, badgeType: string, block: Block): AchievementInput {
  return {
    courseSlug,
    type: badgeType,
    name: block.badge.label,
    description: block.objective || content.summary || block.title,
    criteria: block.badge.conditions,
    competencies: content.competencies,
  };
}

async function signVcJwt(vc: object, recipientHash: string, credentialId: string): Promise<string> {
  const { privateKey, kid } = await getKeys();
  return new SignJWT({ vc })
    .setProtectedHeader({ alg: JWT_ALG, kid, typ: "vc+jwt" })
    .setIssuer(issuerId())
    .setSubject(`sha256$${recipientHash}`)
    .setJti(credentialUrl(credentialId))
    .setIssuedAt()
    .sign(privateKey);
}

/** Mint a credential for a freshly issued badge (called from the engine). */
export async function issueCredential(params: {
  badgeId: string; enrollmentId: string; recipientEmail: string; recipientName: string;
  courseSlug: string; badgeType: string; content: CourseContent; block: Block;
}) {
  const salt = randomBytes(16).toString("hex");
  const recipientHash = sha256(params.recipientEmail.toLowerCase() + salt);
  const achievement = achievementFor(params.content, params.courseSlug, params.badgeType, params.block);
  const issuedAt = new Date();

  // Create the row first to get a stable id for the hosted URLs.
  const row = await prisma.credential.create({
    data: {
      badgeId: params.badgeId, enrollmentId: params.enrollmentId, achievementType: params.badgeType,
      recipientSalt: salt, recipientHash, assertion: {}, vcJwt: "tmp",
    },
  });
  const assertion = hostedAssertion({ credentialId: row.id, achievement, recipientHash, recipientSalt: salt, issuedAt, revoked: false });
  const vc = verifiableCredential({ credentialId: row.id, achievement, recipientHash, subjectName: params.recipientName, issuedAt });
  const vcJwt = await signVcJwt(vc, recipientHash, row.id);

  return prisma.credential.update({
    where: { id: row.id },
    data: { assertion: assertion as unknown as Prisma.InputJsonValue, vcJwt, issuedAt },
  });
}

export async function getCredential(id: string) {
  const c = await prisma.credential.findUnique({ where: { id } });
  if (!c) throw new CredentialError(404, "not_found", "Credential introuvable");
  return c;
}

/** OB 2.0 hosted assertion (public). Reflects revocation live. */
export async function hostedAssertionDoc(id: string) {
  const c = await getCredential(id);
  const a = c.assertion as Record<string, unknown>;
  if (c.revokedAt) return { ...a, revoked: true, revocationReason: c.revocationReason ?? "revoked" };
  return a;
}

export async function vcJwt(id: string) {
  return (await getCredential(id)).vcJwt;
}

/** Verify a VC-JWT (signature + issuer + revocation). Public. */
export async function verify(input: { jws?: string; credentialId?: string }) {
  let jws = input.jws;
  if (!jws && input.credentialId) jws = (await getCredential(input.credentialId)).vcJwt;
  if (!jws) throw new CredentialError(400, "missing", "Fournir jws ou credentialId");

  try {
    const { verifyKey } = await getKeys();
    const { payload } = await jwtVerify(jws, verifyKey, { algorithms: [JWT_ALG], issuer: issuerId() });
    const vc = (payload as { vc?: any }).vc;
    const credId = typeof payload.jti === "string" ? payload.jti.split("/").pop()! : input.credentialId;
    const row = credId ? await prisma.credential.findUnique({ where: { id: credId } }) : null;
    const revoked = Boolean(row?.revokedAt);
    return {
      valid: !revoked,
      revoked,
      issuer: payload.iss,
      subject: payload.sub,
      achievement: vc?.credentialSubject?.achievement?.name ?? null,
      issuedOn: vc?.issuanceDate ?? null,
      ...(revoked ? { revocationReason: row?.revocationReason } : {}),
    };
  } catch (e) {
    return { valid: false, revoked: false, error: "signature_invalid", message: e instanceof Error ? e.message : "invalide" };
  }
}

export async function revoke(id: string, reason: string | undefined, actorId: string | undefined) {
  await getCredential(id);
  const updated = await prisma.credential.update({ where: { id }, data: { revokedAt: new Date(), revocationReason: reason ?? "revoked" } });
  return { id: updated.id, revoked: true, revokedAt: updated.revokedAt };
}

export async function listForEnrollment(enrollmentId: string) {
  const creds = await prisma.credential.findMany({ where: { enrollmentId }, orderBy: { issuedAt: "asc" }, include: { badge: true } });
  return creds.map((c) => ({
    id: c.id, achievementType: c.achievementType, issuedAt: c.issuedAt, revoked: Boolean(c.revokedAt),
    badgeLabel: c.badge.type, hostedUrl: credentialUrl(c.id), verifyUrl: `${credentialUrl(c.id)}/verify`,
  }));
}

/** Certificate PDF for a credential. */
export async function certificate(id: string): Promise<Buffer> {
  const c = await prisma.credential.findUnique({
    where: { id }, include: { enrollment: { include: { user: true, courseVersion: true } } },
  });
  if (!c) throw new CredentialError(404, "not_found", "Credential introuvable");
  const a = c.assertion as { badge?: { name?: string } };
  return certificatePdf({
    recipientName: c.enrollment.user.name,
    achievementName: a.badge?.name ?? c.achievementType,
    courseTitle: c.enrollment.courseVersion.title,
    issuedOn: c.issuedAt,
    verifyUrl: credentialUrl(c.id),
  });
}

/** Resolve the content block whose badge matches a badge type (for issuance). */
export function blockForBadgeType(content: CourseContent, badgeType: string): Block | undefined {
  return content.blocks.find((b) => badgeTypeForBlock(b.type) === badgeType);
}
