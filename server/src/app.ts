/** Fastify app factory — wires plugins and route modules. */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { env, isDev } from "./config/env.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { courseRoutes } from "./modules/courses/courses.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { userRoutes } from "./modules/users/users.routes.js";
import { enrollmentRoutes } from "./modules/enrollments/enrollments.routes.js";
import { feedbackRoutes } from "./modules/feedback/feedback.routes.js";
import { searchRoutes } from "./modules/search/search.routes.js";
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
      await courseRoutes(api);
      await userRoutes(api);
      await enrollmentRoutes(api);
      await feedbackRoutes(api);
      await searchRoutes(api);
      await auditRoutes(api);
      await jobRoutes(api);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
