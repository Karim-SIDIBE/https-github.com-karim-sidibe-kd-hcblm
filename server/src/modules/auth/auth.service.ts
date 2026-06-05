/**
 * auth.service.ts — first-party login + refresh-token rotation with reuse
 * detection (OAuth 2.0 Security BCP / RFC 9700).
 *
 * Access tokens are short-lived JWTs (stateless). Refresh tokens are opaque,
 * stored only as SHA-256 hashes, rotated on every use; presenting an already-
 * rotated token revokes the whole family (compromise containment).
 */
import { createHash, randomBytes, randomUUID, randomInt } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { verifyPassword, hashPassword } from "../../lib/auth/password.js";
import { signAccessToken } from "../../lib/auth/jwt.js";
import { audit } from "../../lib/audit.js";
import { sendMultichannel } from "../../lib/notify/send.js";
import { otpMessage } from "../../lib/notify/templates.js";

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
  // Checked only AFTER a correct password, so a disabled account is not
  // distinguishable from a wrong password to an attacker (no enumeration).
  if (user.disabledAt) {
    await audit({ actorId: user.id, action: "auth.login.disabled", ip, meta: { email } });
    throw new AuthError("account_disabled", "Compte désactivé — contactez votre administrateur");
  }
  // B2C: a self-registered account must verify its e-mail (OTP) before logging in.
  if (!user.emailVerifiedAt) {
    await audit({ actorId: user.id, action: "auth.login.unverified", ip, meta: { email } });
    throw new AuthError("email_unverified", "E-mail non vérifié — saisissez le code reçu par e-mail");
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
    user = await prisma.user.create({ data: { email: params.email, name: params.name || params.email, role: "LEARNER", emailVerifiedAt: new Date() } });
    await audit({ actorId: user.id, action: "auth.federated.provisioned", ip: params.ip, meta: { email: params.email, via: params.via } });
  }
  if (user.disabledAt) {
    await audit({ actorId: user.id, action: "auth.federated.disabled", ip: params.ip, meta: { via: params.via } });
    throw new AuthError("account_disabled", "Compte désactivé");
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
  if (user.disabledAt) {
    await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw new AuthError("account_disabled", "Compte désactivé");
  }

  const next = await issueRefresh(user.id, row.familyId);
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), replacedById: next.id } });
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, name: user.name });
  return { accessToken, refreshToken: next.token, tokenType: "Bearer", expiresIn: env.ACCESS_TTL, refreshExpiresAt: next.expiresAt };
}

// --- B2C self-registration + e-mail verification (OTP) ----------------------

const OTP_TTL_MIN = 15;
const genOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

async function issueOtpAndSend(user: { id: string; email: string; phone: string | null }) {
  const code = genOtp();
  await prisma.verificationCode.create({
    data: { userId: user.id, codeHash: sha256(code), purpose: "EMAIL_VERIFY", expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) },
  });
  const m = otpMessage(code, OTP_TTL_MIN);
  await sendMultichannel({ email: user.email, phone: user.phone, subject: m.subject, body: m.body, mobileBody: m.mobileBody });
}

/** Public self-registration: create an unverified LEARNER and send an OTP. */
export async function registerLearner(params: { name: string; email: string; password: string; phone?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: params.email } });
  if (existing) {
    if (!existing.emailVerifiedAt) { await issueOtpAndSend(existing); return { verificationRequired: true as const, email: existing.email }; }
    throw new AuthError("email_taken", "Un compte existe déjà avec cet e-mail");
  }
  const user = await prisma.user.create({
    data: { name: params.name, email: params.email, role: "LEARNER", phone: params.phone ?? null, passwordHash: await hashPassword(params.password) },
  });
  await issueOtpAndSend(user);
  await audit({ actorId: user.id, action: "auth.register", meta: { email: user.email } });
  return { verificationRequired: true as const, email: user.email };
}

/** Verify the OTP, mark the e-mail verified, and issue a session (auto-login). */
export async function verifyEmail(email: string, code: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AuthError("invalid_code", "Code invalide ou expiré");
  if (user.emailVerifiedAt) throw new AuthError("already_verified", "Compte déjà vérifié — connectez-vous");
  const rec = await prisma.verificationCode.findFirst({
    where: { userId: user.id, purpose: "EMAIL_VERIFY", consumedAt: null, expiresAt: { gt: new Date() }, codeHash: sha256(code) },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) throw new AuthError("invalid_code", "Code invalide ou expiré");
  await prisma.$transaction([
    prisma.verificationCode.update({ where: { id: rec.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }),
  ]);
  await audit({ actorId: user.id, action: "auth.verify.success", ip });
  return { ...(await tokensFor(user)), user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

/** Resend an OTP to an unverified account. Always returns ok (no enumeration). */
export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerifiedAt) await issueOtpAndSend(user);
  return { ok: true };
}

/** Forgot password: send a reset code. Always returns ok (no enumeration). */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.passwordHash) {
    const code = genOtp();
    await prisma.verificationCode.create({
      data: { userId: user.id, codeHash: sha256(code), purpose: "PASSWORD_RESET", expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) },
    });
    const m = otpMessage(code, OTP_TTL_MIN);
    await sendMultichannel({ email: user.email, phone: user.phone, subject: m.subject, body: m.body, mobileBody: m.mobileBody });
    await audit({ actorId: user.id, action: "auth.password.forgot" });
  }
  return { ok: true };
}

/** Reset the password with a valid code: clears lockout, verifies the e-mail,
 *  and issues a session (auto-login). */
export async function resetPassword(email: string, code: string, newPassword: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AuthError("invalid_code", "Code invalide ou expiré");
  const rec = await prisma.verificationCode.findFirst({
    where: { userId: user.id, purpose: "PASSWORD_RESET", consumedAt: null, expiresAt: { gt: new Date() }, codeHash: sha256(code) },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) throw new AuthError("invalid_code", "Code invalide ou expiré");
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.verificationCode.update({ where: { id: rec.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: user.emailVerifiedAt ?? new Date() } }),
  ]);
  await audit({ actorId: user.id, action: "auth.password.reset", ip });
  return { ...(await tokensFor(user)), user: { id: user.id, name: user.name, email: user.email, role: user.role } };
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
