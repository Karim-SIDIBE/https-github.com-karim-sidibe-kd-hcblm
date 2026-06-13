/** Fastify app factory — wires plugins and route modules. */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { env, isDev } from "./config/env.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { courseRoutes } from "./modules/courses/courses.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { samlRoutes } from "./modules/auth/saml.routes.js";
import { ltiRoutes } from "./modules/lti/lti.routes.js";
import { userRoutes } from "./modules/users/users.routes.js";
import { organizationRoutes } from "./modules/organizations/organizations.routes.js";
import { scimRoutes } from "./modules/scim/scim.routes.js";
import { enrollmentRoutes } from "./modules/enrollments/enrollments.routes.js";
import { offlineRoutes } from "./modules/offline/offline.routes.js";
import { feedbackRoutes } from "./modules/feedback/feedback.routes.js";
import { searchRoutes } from "./modules/search/search.routes.js";
import { tutorRoutes } from "./modules/tutor/tutor.routes.js";
import { sessionRoutes } from "./modules/sessions/sessions.routes.js";
import { forumRoutes } from "./modules/forum/forum.routes.js";
import { mediaRoutes } from "./modules/media/media.routes.js";
import { interopRoutes } from "./modules/interop/interop.routes.js";
import { exportRoutes } from "./modules/export/export.routes.js";
import { credentialRoutes } from "./modules/credentials/credentials.routes.js";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { webhookRoutes } from "./modules/webhooks/webhooks.routes.js";
import { docsRoutes } from "./modules/docs/docs.routes.js";
import { jobRoutes } from "./modules/jobs/jobs.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isDev
      ? { level: env.LOG_LEVEL, transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }
      : { level: env.LOG_LEVEL },
  });

  // Restrict CORS to the configured front-end origins in production; reflect any
  // origin when CORS_ORIGINS is unset (dev).
  await app.register(cors, {
    origin: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(",").map((o) => o.trim()) : true,
  });

  // Security headers (defense in depth, in addition to the edge proxy). LMS-aware
  // config: we deliberately DO NOT enable the headers that break standard LMS
  // flows, and enable the ones that are pure wins:
  //   - CSP off here: the API serves JSON + the SAML ACS auto-POST HTML form and
  //     LTI launch HTML; CSP belongs on the static front-ends (served by Caddy).
  //   - frameguard off: an LTI *tool* launch is rendered inside the consumer LMS
  //     iframe — X-Frame-Options: DENY would break it.
  //   - CORP cross-origin: media is served to the PWA on a different sub-domain.
  // Still emitted: X-Content-Type-Options=nosniff, Strict-Transport-Security,
  // Referrer-Policy, X-DNS-Prefetch-Control, Origin-Agent-Cluster, no X-Powered-By.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  });

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
  // Tolerate empty JSON bodies (no-body POSTs like /publish, /scim/token).
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    try { done(null, body && (body as string).length ? JSON.parse(body as string) : {}); }
    catch (e) { (e as { statusCode?: number }).statusCode = 400; done(e as Error); }
  });
  // SCIM clients send application/scim+json — parse it as JSON.
  app.addContentTypeParser("application/scim+json", { parseAs: "string" }, (_req, body, done) => {
    try { done(null, body && (body as string).length ? JSON.parse(body as string) : {}); }
    catch (e) { done(e as Error); }
  });

  // Uniform validation-error shape for Zod failures raised inside handlers.
  // Fastify v5 types the error as `unknown`; narrow before use.
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: "validation_error",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    app.log.error({ err }, "unhandled error");
    const e = err as { statusCode?: number; name?: string; message?: string };
    const status = e.statusCode ?? 500;
    // Don't leak internal error details on 5xx in production (info disclosure).
    // 4xx messages (validation, not-found, conflicts…) stay informative.
    const message = status >= 500 && env.NODE_ENV === "production" ? "Erreur interne du serveur" : e.message;
    return reply.status(status).send({ error: e.name ?? "internal_error", message });
  });

  await app.register(
    async (api) => {
      await healthRoutes(api);
      await authRoutes(api);
      await samlRoutes(api);
      await ltiRoutes(api);
      await courseRoutes(api);
      await userRoutes(api);
      await organizationRoutes(api);
      await scimRoutes(api);
      await enrollmentRoutes(api);
      await offlineRoutes(api);
      await feedbackRoutes(api);
      await searchRoutes(api);
      await tutorRoutes(api);
      await sessionRoutes(api);
      await forumRoutes(api);
      await mediaRoutes(api);
      await interopRoutes(api);
      await exportRoutes(api);
      await credentialRoutes(api);
      await analyticsRoutes(api);
      await auditRoutes(api);
      await webhookRoutes(api);
      await docsRoutes(api);
      await jobRoutes(api);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
