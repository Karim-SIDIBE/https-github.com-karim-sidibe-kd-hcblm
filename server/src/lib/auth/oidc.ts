/**
 * oidc.ts — verify access/ID tokens from an external IdP (enterprise SSO).
 *
 * Standard OIDC: signatures verified against the IdP's published JWKS
 * (`createRemoteJWKSet` caches + rotates keys), with strict `iss`/`aud` checks.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { env, oidcEnabled } from "../../config/env.js";

let jwks: JWTVerifyGetKey | undefined;

export async function verifyExternalToken(token: string): Promise<JWTPayload> {
  if (!oidcEnabled) throw new Error("OIDC non configuré");
  jwks ??= createRemoteJWKSet(new URL(env.OIDC_JWKS_URI!));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: env.OIDC_ISSUER!,
    audience: env.OIDC_AUDIENCE!,
    algorithms: ["ES256", "RS256", "EdDSA"],
    clockTolerance: 5,
  });
  return payload;
}
