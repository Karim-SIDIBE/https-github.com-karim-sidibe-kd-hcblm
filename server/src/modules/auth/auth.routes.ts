import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { AuthError, login, logout, refresh } from "./auth.service.js";
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

  app.post("/auth/refresh", authLimit, async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    try { return await refresh(refreshToken, req.ip); } catch (err) { return mapErr(reply, err); }
  });

  app.post("/auth/logout", async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    try { return await logout(refreshToken, req.ip); } catch (err) { return mapErr(reply, err); }
  });

  // Identity of the current principal (any authenticated token).
  app.get("/auth/me", { preHandler: authenticate }, async (req) => ({ data: req.principal }));
}
