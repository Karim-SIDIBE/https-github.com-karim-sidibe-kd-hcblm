/**
 * lti.ts — LTI 1.3 Tool helpers (we are the Tool an LMS launches into).
 *
 * Reuses the OIDC machinery: the platform's id_token (a launch JWT) is verified
 * against the platform's published JWKS, then the LTI claims are validated.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";

export const LTI = {
  messageType: "https://purl.imsglobal.org/spec/lti/claim/message_type",
  version: "https://purl.imsglobal.org/spec/lti/claim/version",
  deploymentId: "https://purl.imsglobal.org/spec/lti/claim/deployment_id",
  roles: "https://purl.imsglobal.org/spec/lti/claim/roles",
  resourceLink: "https://purl.imsglobal.org/spec/lti/claim/resource_link",
  targetLinkUri: "https://purl.imsglobal.org/spec/lti/claim/target_link_uri",
  context: "https://purl.imsglobal.org/spec/lti/claim/context",
} as const;

export type LtiPlatformLike = { issuer: string; clientId: string; deploymentId: string | null; jwksUrl: string };

const jwksCache = new Map<string, JWTVerifyGetKey>();
function jwksFor(url: string): JWTVerifyGetKey {
  let set = jwksCache.get(url);
  if (!set) { set = createRemoteJWKSet(new URL(url)); jwksCache.set(url, set); }
  return set;
}

export type LtiLaunch = {
  sub: string;
  email: string | null;
  name: string | null;
  roles: string[];
  deploymentId: string;
  resourceLinkId: string | null;
  context: { id?: string; title?: string } | null;
  raw: JWTPayload;
};

export class LtiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Verify the platform id_token + validate the LTI resource-link launch claims. */
export async function verifyLaunch(platform: LtiPlatformLike, idToken: string, expectedNonce: string): Promise<LtiLaunch> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, jwksFor(platform.jwksUrl), {
      issuer: platform.issuer, audience: platform.clientId, algorithms: ["RS256", "ES256", "EdDSA"], clockTolerance: 5,
    }));
  } catch (e) {
    throw new LtiError("invalid_token", `id_token invalide : ${e instanceof Error ? e.message : e}`);
  }

  if (payload.nonce !== expectedNonce) throw new LtiError("bad_nonce", "Nonce LTI invalide");
  const p = payload as Record<string, unknown>;
  if (p[LTI.messageType] !== "LtiResourceLinkRequest") throw new LtiError("bad_message", "message_type LTI non supporté");
  if (p[LTI.version] !== "1.3.0") throw new LtiError("bad_version", "Version LTI non supportée");
  const deploymentId = String(p[LTI.deploymentId] ?? "");
  if (!deploymentId) throw new LtiError("no_deployment", "deployment_id manquant");
  if (platform.deploymentId && platform.deploymentId !== deploymentId) throw new LtiError("bad_deployment", "deployment_id non reconnu");

  const rl = p[LTI.resourceLink] as { id?: string } | undefined;
  const ctx = p[LTI.context] as { id?: string; title?: string } | undefined;
  return {
    sub: String(payload.sub),
    email: typeof p.email === "string" ? p.email : null,
    name: typeof p.name === "string" ? p.name : null,
    roles: Array.isArray(p[LTI.roles]) ? (p[LTI.roles] as string[]) : [],
    deploymentId,
    resourceLinkId: rl?.id ?? null,
    context: ctx ? { id: ctx.id, title: ctx.title } : null,
    raw: payload,
  };
}

/** Build the redirect to the platform's auth endpoint (OIDC third-party initiation). */
export function buildAuthRedirect(params: {
  authLoginUrl: string; clientId: string; redirectUri: string; loginHint: string;
  state: string; nonce: string; ltiMessageHint?: string;
}): string {
  const q = new URLSearchParams({
    scope: "openid", response_type: "id_token", response_mode: "form_post",
    client_id: params.clientId, redirect_uri: params.redirectUri, login_hint: params.loginHint,
    state: params.state, nonce: params.nonce, prompt: "none",
    ...(params.ltiMessageHint ? { lti_message_hint: params.ltiMessageHint } : {}),
  });
  return `${params.authLoginUrl}?${q.toString()}`;
}
