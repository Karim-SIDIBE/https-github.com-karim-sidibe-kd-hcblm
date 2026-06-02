/** Fastify app factory — wires plugins and route modules. */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { env, isDev } from "./config/env.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { courseRoutes } from "./modules/courses/courses.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { samlRoutes } from "./modules/auth/saml.routes.js";
import { userRoutes } from "./modules/users/users.routes.js";
import { enrollmentRoutes } from "./modules/enrollments/enrollments.routes.js";
import { offlineRoutes } from "./modules/offline/offline.routes.js";
import { feedbackRoutes } from "./modules/feedback/feedback.routes.js";
import { searchRoutes } from "./modules/search/search.routes.js";
import { sessionRoutes } from "./modules/sessions/sessions.routes.js";
import { forumRoutes } from "./modules/forum/forum.routes.js";
import { mediaRoutes } from "./modules/media/media.routes.js";
import { credentialRoutes } from "./modules/credentials/credentials.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { jobRoutes } from "./modules/jobs/jobs.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isDev
      ? { level: env.LOG_LEVEL, transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }
      : { level: env.LOG_LEVEL },
  });

  await app.register(cors, { origin: true });
  await app.register(sensible);
  // Global IP rate limit (per minute). Auth routes get a stricter cap below.
  await app.register(rateLimit, { global: true, max: env.RATE_LIMIT_MAX, timeWindow: "1 minute" });

  // Multipart uploads (media assets), capped by MEDIA_MAX_BYTES.
  await app.register(multipart, { limits: { fileSize: env.MEDIA_MAX_BYTES } });

  // Parse application/x-www-form-urlencoded (SAML IdP posts the ACS form-encoded).
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
    try { done(null, Object.fromEntries(new URLSearchParams(body as string))); }
    catch (e) { done(e as Error); }
  });

  // Uniform validation-error shape for Zod failures raised inside handlers.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: "validation_error",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    app.log.error({ err }, "unhandled error");
    return reply.status(err.statusCode ?? 500).send({ error: err.name ?? "internal_error", message: err.message });
  });

  await app.register(
    async (api) => {
      await healthRoutes(api);
      await authRoutes(api);
      await samlRoutes(api);
      await courseRoutes(api);
      await userRoutes(api);
      await enrollmentRoutes(api);
      await offlineRoutes(api);
      await feedbackRoutes(api);
      await searchRoutes(api);
      await sessionRoutes(api);
      await forumRoutes(api);
      await mediaRoutes(api);
      await credentialRoutes(api);
      await auditRoutes(api);
      await jobRoutes(api);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
