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
