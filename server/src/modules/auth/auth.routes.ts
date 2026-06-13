import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { AuthError, login, logout, refresh, registerLearner, verifyEmail, resendVerification, forgotPassword, resetPassword, setupTotp, enableTotp, disableTotp, verifyTwoFactorLogin } from "./auth.service.js";
import { publicJwks } from "../../lib/auth/keys.js";
import { authenticate } from "../../lib/auth.js";
import { env } from "../../config/env.js";

/** Stricter per-IP cap for credential endpoints (defence in depth with lockout). */
const authLimit = { config: { rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, timeWindow: "1 minute" } } };

function mapErr(reply: FastifyReply, err: unknown) {
  if (err instanceof AuthError) {
    const status = err.code === "account_locked" ? 429 : 401; // 429 for lockout/throttle
    return reply.status(status).send({ error: err.code, message: err.message });
  }
  throw err;
}

export async function authRoutes(app: FastifyInstance) {
  // Public JWKS — lets other services verify our access tokens.
  app.get("/.well-known/jwks.json", async () => publicJwks());

  app.post("/auth/login", authLimit, async (req, reply) => {
    const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    try { return await login(email, password, req.ip); } catch (err) { return mapErr(reply, err); }
  });

  // B2C self-registration → creates an unverified LEARNER + sends an OTP.
  // `website` is a honeypot field: real users leave it empty; bots fill it.
  app.post("/auth/register", authLimit, async (req, reply) => {
    const body = z.object({
      name: z.string().trim().min(1),
      email: z.string().email(),
      password: z.string().min(10, "10 caractères minimum"),
      phone: z.string().trim().min(1).optional(),
      website: z.string().optional(),
    }).parse(req.body);
    if (body.website) return reply.status(400).send({ error: "rejected", message: "Requête invalide" });
    try { return reply.status(201).send({ data: await registerLearner(body) }); }
    catch (err) {
      if (err instanceof AuthError) return reply.status(409).send({ error: err.code, message: err.message });
      throw err;
    }
  });

  // Verify the OTP → marks the e-mail verified and logs the user in.
  app.post("/auth/verify", authLimit, async (req, reply) => {
    const { email, code } = z.object({ email: z.string().email(), code: z.string().trim().min(4) }).parse(req.body);
    try { return await verifyEmail(email, code, req.ip); }
    catch (err) {
      if (err instanceof AuthError) return reply.status(400).send({ error: err.code, message: err.message });
      throw err;
    }
  });

  app.post("/auth/resend-verification", authLimit, async (req, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    return { data: await resendVerification(email) };
  });

  // Forgot password → e-mail a reset code (always ok; no enumeration).
  app.post("/auth/forgot-password", authLimit, async (req) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    return { data: await forgotPassword(email) };
  });

  // Reset with the code → clears lockout + logs in.
  app.post("/auth/reset-password", authLimit, async (req, reply) => {
    const { email, code, password } = z.object({ email: z.string().email(), code: z.string().trim().min(4), password: z.string().min(10, "10 caractères minimum") }).parse(req.body);
    try { return await resetPassword(email, code, password, req.ip); }
    catch (err) { if (err instanceof AuthError) return reply.status(400).send({ error: err.code, message: err.message }); throw err; }
  });

  app.post("/auth/refresh", authLimit, async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    try { return await refresh(refreshToken, req.ip); } catch (err) { return mapErr(reply, err); }
  });

  app.post("/auth/logout", async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    try { return await logout(refreshToken, req.ip); } catch (err) { return mapErr(reply, err); }
  });

  // --- two-factor (TOTP) ---
  // Complete a login that returned { twoFactorRequired: true, challenge }.
  app.post("/auth/2fa/verify", authLimit, async (req, reply) => {
    const { challenge, code } = z.object({ challenge: z.string().min(1), code: z.string().trim().min(6) }).parse(req.body);
    try { return await verifyTwoFactorLogin(challenge, code, req.ip); } catch (err) { return mapErr(reply, err); }
  });

  // Begin enrolment → returns the secret + otpauth URI (render as a QR code).
  app.post("/auth/2fa/setup", { preHandler: authenticate }, async (req, reply) => {
    try { return { data: await setupTotp(req.principal!.id) }; } catch (err) { return mapErr(reply, err); }
  });

  // Confirm enrolment with a code → activates 2FA, returns one-time backup codes.
  app.post("/auth/2fa/enable", { preHandler: authenticate }, async (req, reply) => {
    const { code } = z.object({ code: z.string().trim().min(6) }).parse(req.body);
    try { return { data: await enableTotp(req.principal!.id, code, req.ip) }; } catch (err) { return mapErr(reply, err); }
  });

  // Disable 2FA (requires a current TOTP or backup code).
  app.post("/auth/2fa/disable", { preHandler: authenticate }, async (req, reply) => {
    const { code } = z.object({ code: z.string().trim().min(6) }).parse(req.body);
    try { return { data: await disableTotp(req.principal!.id, code, req.ip) }; } catch (err) { return mapErr(reply, err); }
  });

  // Identity of the current principal (any authenticated token).
  app.get("/auth/me", { preHandler: authenticate }, async (req) => ({ data: req.principal }));
}
