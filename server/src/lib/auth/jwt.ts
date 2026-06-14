/**
 * jwt.ts — first-party access-token signing & verification.
 *
 * Hardened per RFC 8725 (JWT BCP): single fixed algorithm allowlist (ES256),
 * explicit `iss`/`aud` validation, expiry enforced, small clock-skew leeway.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { getKeys, JWT_ALG } from "./keys.js";

export type AccessClaims = { sub: string; role: string; name: string };

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  const { privateKey, kid } = await getKeys();
  return new SignJWT({ role: claims.role, name: claims.name })
    .setProtectedHeader({ alg: JWT_ALG, kid, typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(env.AUTH_ISSUER)
    .setAudience(env.AUTH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TTL)
    .setJti(randomUUID())
    .sign(privateKey);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { verifyKey } = await getKeys();
  const { payload } = await jwtVerify(token, verifyKey, {
    issuer: env.AUTH_ISSUER,
    audience: env.AUTH_AUDIENCE,
    algorithms: [JWT_ALG], // reject `none` and algorithm-confusion attempts
    clockTolerance: 5,
  });
  return payload;
}

// --- two-factor challenge (interim token between password and TOTP step) -----
// Signed with a DISTINCT audience so it can never be used as an access token:
// verifyAccessToken (audience = AUTH_AUDIENCE) rejects it by construction.
const TWO_FACTOR_AUDIENCE = `${env.AUTH_AUDIENCE}:2fa`;
const TWO_FACTOR_TTL = "5m";

export async function signTwoFactorChallenge(sub: string): Promise<string> {
  const { privateKey, kid } = await getKeys();
  return new SignJWT({ pending2fa: true })
    .setProtectedHeader({ alg: JWT_ALG, kid, typ: "JWT" })
    .setSubject(sub)
    .setIssuer(env.AUTH_ISSUER)
    .setAudience(TWO_FACTOR_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TWO_FACTOR_TTL)
    .setJti(randomUUID())
    .sign(privateKey);
}

/** Verify a 2FA challenge token → the pending user id. Throws if invalid/expired. */
export async function verifyTwoFactorChallenge(token: string): Promise<string> {
  const { verifyKey } = await getKeys();
  const { payload } = await jwtVerify(token, verifyKey, {
    issuer: env.AUTH_ISSUER,
    audience: TWO_FACTOR_AUDIENCE,
    algorithms: [JWT_ALG],
    clockTolerance: 5,
  });
  if (payload.pending2fa !== true || !payload.sub) throw new Error("invalid 2fa challenge");
  return payload.sub;
}
