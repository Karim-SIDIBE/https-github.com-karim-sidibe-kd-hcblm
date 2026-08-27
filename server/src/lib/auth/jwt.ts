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

// --- media access token --------------------------------------------------------
// Short-lived, URL-embeddable grant so a native <video> element (which cannot
// send an Authorization header) can stream a protected rendition. Scoped to one
// asset, distinct audience so it is useless as an access token.
const MEDIA_AUDIENCE = `${env.AUTH_AUDIENCE}:media`;
const MEDIA_TTL = "6h";

export async function signMediaToken(assetId: string): Promise<string> {
  const { privateKey, kid } = await getKeys();
  return new SignJWT({ media: true })
    .setProtectedHeader({ alg: JWT_ALG, kid, typ: "JWT" })
    .setSubject(assetId)
    .setIssuer(env.AUTH_ISSUER)
    .setAudience(MEDIA_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(MEDIA_TTL)
    .sign(privateKey);
}

/** Verify a media token → the asset id it grants. Throws if invalid/expired. */
export async function verifyMediaToken(token: string): Promise<string> {
  const { verifyKey } = await getKeys();
  const { payload } = await jwtVerify(token, verifyKey, {
    issuer: env.AUTH_ISSUER,
    audience: MEDIA_AUDIENCE,
    algorithms: [JWT_ALG],
    clockTolerance: 5,
  });
  if (payload.media !== true || !payload.sub) throw new Error("invalid media token");
  return payload.sub;
}

// --- guest order token ---------------------------------------------------------
// Tunnel d'achat invité (spec paiement, PAY-2bis) : l'acheteur sans compte suit
// sa commande (statut, reprise du checkout, reçu) via ce jeton scellé sur UNE
// commande. Audience dédiée → inutilisable comme jeton d'accès. TTL généreux :
// un virement B2C peut prendre plusieurs jours.
const ORDER_AUDIENCE = `${env.AUTH_AUDIENCE}:order`;
const ORDER_TTL = "14d";

export async function signOrderToken(orderId: string): Promise<string> {
  const { privateKey, kid } = await getKeys();
  return new SignJWT({ order: true })
    .setProtectedHeader({ alg: JWT_ALG, kid, typ: "JWT" })
    .setSubject(orderId)
    .setIssuer(env.AUTH_ISSUER)
    .setAudience(ORDER_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ORDER_TTL)
    .sign(privateKey);
}

/** Verify an order token → the order id it grants. Throws if invalid/expired. */
export async function verifyOrderToken(token: string): Promise<string> {
  const { verifyKey } = await getKeys();
  const { payload } = await jwtVerify(token, verifyKey, {
    issuer: env.AUTH_ISSUER,
    audience: ORDER_AUDIENCE,
    algorithms: [JWT_ALG],
    clockTolerance: 5,
  });
  if (payload.order !== true || !payload.sub) throw new Error("invalid order token");
  return payload.sub;
}
