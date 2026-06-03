/**
 * auth.service.ts — first-party login + refresh-token rotation with reuse
 * detection (OAuth 2.0 Security BCP / RFC 9700).
 *
 * Access tokens are short-lived JWTs (stateless). Refresh tokens are opaque,
 * stored only as SHA-256 hashes, rotated on every use; presenting an already-
 * rotated token revokes the whole family (compromise containment).
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { verifyPassword } from "../../lib/auth/password.js";
import { signAccessToken } from "../../lib/auth/jwt.js";
import { audit } from "../../lib/audit.js";

export class AuthError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const newOpaque = () => randomBytes(32).toString("base64url");

async function issueRefresh(userId: string, familyId?: string) {
  const token = newOpaque();
  const fam = familyId ?? randomUUID();
  const expiresAt = new Date(Date.now() + env.REFRESH_TTL_DAYS * 86_400_000);
  const row = await prisma.refreshToken.create({ data: { userId, familyId: fam, tokenHash: sha256(token), expiresAt } });
  return { token, id: row.id, familyId: fam, expiresAt };
}

async function tokensFor(user: { id: string; role: string; name: string }, familyId?: string) {
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, name: user.name });
  const refresh = await issueRefresh(user.id, familyId);
  return { accessToken, refreshToken: refresh.token, tokenType: "Bearer", expiresIn: env.ACCESS_TTL, refreshExpiresAt: refresh.expiresAt };
}

/**
 * Verify credentials and issue tokens. Account lockout after N failures (OWASP),
 * uniform `invalid_credentials` error to avoid user enumeration, full audit.
 */
export async function login(email: string, password: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const now = new Date();

  if (user?.lockedUntil && user.lockedUntil > now) {
    await audit({ actorId: user.id, action: "auth.login.locked", ip, meta: { email } });
    throw new AuthError("account_locked", "Compte temporairement verrouillé — réessayez plus tard");
  }

  const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, password) : false;
  if (!user || !ok) {
    if (user) {
      const count = user.failedLoginCount + 1;
      const locked = count >= env.LOGIN_MAX_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: locked
          ? { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60_000) }
          : { failedLoginCount: count },
      });
      await audit({ actorId: user.id, action: locked ? "auth.login.lockout" : "auth.login.failure", ip, meta: { email, count } });
    } else {
      await audit({ action: "auth.login.failure", ip, meta: { email, reason: "unknown_user" } });
    }
    throw new AuthError("invalid_credentials", "Identifiants invalides");
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }
  await audit({ actorId: user.id, action: "auth.login.success", ip });
  return { ...(await tokensFor(user)), user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

/**
 * Federated login (SAML/OIDC): map a verified external identity to a local user
 * (JIT-provision a LEARNER when allowed) and issue first-party tokens.
 */
export async function federatedLogin(params: { email: string; name?: string | null; jit: boolean; via: string; ip?: string }) {
  let user = await prisma.user.findUnique({ where: { email: params.email } });
  if (!user) {
    if (!params.jit) {
      await audit({ action: "auth.federated.denied", ip: params.ip, meta: { email: params.email, via: params.via, reason: "no_account" } });
      throw new AuthError("no_account", "Aucun compte pour cette identité fédérée");
    }
    user = await prisma.user.create({ data: { email: params.email, name: params.name || params.email, role: "LEARNER" } });
    await audit({ actorId: user.id, action: "auth.federated.provisioned", ip: params.ip, meta: { email: params.email, via: params.via } });
  }
  await audit({ actorId: user.id, action: "auth.federated.success", ip: params.ip, meta: { via: params.via } });
  return { ...(await tokensFor(user)), user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

/** Rotate a refresh token; detect reuse of an already-rotated token. */
export async function refresh(presented: string, ip?: string) {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(presented) } });
  if (!row) throw new AuthError("invalid_token", "Refresh token invalide");

  if (row.revokedAt) {
    // Reuse of a rotated token → likely theft. Revoke the whole family.
    await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ actorId: row.userId, action: "auth.token.reuse_detected", ip, meta: { familyId: row.familyId } });
    throw new AuthError("token_reuse_detected", "Réutilisation détectée — session révoquée");
  }
  if (row.expiresAt < new Date()) throw new AuthError("expired_token", "Refresh token expiré");

  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) throw new AuthError("invalid_token", "Utilisateur introuvable");

  const next = await issueRefresh(user.id, row.familyId);
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), replacedById: next.id } });
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, name: user.name });
  return { accessToken, refreshToken: next.token, tokenType: "Bearer", expiresIn: env.ACCESS_TTL, refreshExpiresAt: next.expiresAt };
}

/** Revoke the family of the presented refresh token (logout). */
export async function logout(presented: string, ip?: string) {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(presented) } });
  if (row) {
    await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ actorId: row.userId, action: "auth.logout", ip, meta: { familyId: row.familyId } });
  }
  return { ok: true };
}
