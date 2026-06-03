/**
 * lti.service.ts — LTI 1.3 Tool flow: platform registration, OIDC login
 * initiation, and launch (id_token verification → first-party session).
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { buildAuthRedirect, verifyLaunch, LtiError } from "../../lib/auth/lti.js";
import { federatedLogin } from "../auth/auth.service.js";

export class LtiServiceError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

const base = () => env.PUBLIC_BASE_URL.replace(/\/$/, "");
const launchRedirectUri = () => `${base()}/api/v1/lti/launch`;

export async function registerPlatform(input: { name?: string; issuer: string; clientId: string; deploymentId?: string; authLoginUrl: string; jwksUrl: string; tokenUrl?: string; createdById?: string }) {
  return prisma.ltiPlatform.upsert({
    where: { issuer_clientId: { issuer: input.issuer, clientId: input.clientId } },
    update: { name: input.name, deploymentId: input.deploymentId, authLoginUrl: input.authLoginUrl, jwksUrl: input.jwksUrl, tokenUrl: input.tokenUrl },
    create: { ...input },
  });
}

export function listPlatforms() {
  return prisma.ltiPlatform.findMany({ orderBy: { createdAt: "desc" } });
}

/** OIDC third-party initiation → redirect URL to the platform auth endpoint. */
export async function initiateLogin(params: { iss: string; clientId?: string; loginHint: string; targetLinkUri?: string; ltiMessageHint?: string }) {
  const platform = await prisma.ltiPlatform.findFirst({
    where: { issuer: params.iss, ...(params.clientId ? { clientId: params.clientId } : {}) },
  });
  if (!platform) throw new LtiServiceError(400, "unknown_platform", "Plateforme LTI non enregistrée");

  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  await prisma.ltiNonce.create({
    data: { state, nonce, platformId: platform.id, targetLinkUri: params.targetLinkUri ?? null, expiresAt: new Date(Date.now() + 10 * 60_000) },
  });

  return buildAuthRedirect({
    authLoginUrl: platform.authLoginUrl, clientId: platform.clientId, redirectUri: launchRedirectUri(),
    loginHint: params.loginHint, state, nonce, ltiMessageHint: params.ltiMessageHint,
  });
}

/** Handle the launch: verify the id_token + issue a first-party session. */
export async function handleLaunch(idToken: string, state: string, ip?: string) {
  if (!idToken || !state) throw new LtiServiceError(400, "missing", "id_token et state requis");
  const record = await prisma.ltiNonce.findUnique({ where: { state }, include: { platform: true } });
  if (!record) throw new LtiServiceError(400, "bad_state", "État LTI inconnu ou expiré");
  await prisma.ltiNonce.delete({ where: { id: record.id } }); // single use
  if (record.expiresAt < new Date()) throw new LtiServiceError(400, "expired", "Requête LTI expirée");

  let launch;
  try {
    launch = await verifyLaunch(record.platform, idToken, record.nonce);
  } catch (e) {
    if (e instanceof LtiError) throw new LtiServiceError(401, e.code, e.message);
    throw e;
  }

  const email = launch.email ?? `${launch.sub}@${new URL(record.platform.issuer).hostname}`;
  const session = await federatedLogin({ email, name: launch.name, jit: true, via: "lti", ip });
  return {
    ...session,
    launch: { roles: launch.roles, context: launch.context, resourceLinkId: launch.resourceLinkId, targetLinkUri: record.targetLinkUri },
  };
}
