import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { pingTcp } from "../../lib/net/tcp.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", service: "kd-hcblm", time: new Date().toISOString() }));

  app.get("/health/db", async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "reachable" };
    } catch (err) {
      app.log.error({ err }, "db health check failed");
      return reply.status(503).send({ status: "error", db: "unreachable" });
    }
  });

  // Readiness for orchestration / alerting. The DB is the only *critical*
  // dependency (503 if down). clamd is reported for observability but does not
  // gate readiness — a scanner hiccup must not take the whole API out of service
  // (uploads are gated separately, fail-closed).
  app.get("/health/ready", async (_req, reply) => {
    let db = false;
    try { await prisma.$queryRaw`SELECT 1`; db = true; } catch { /* db down */ }
    // A readiness probe must stay fast — use a short fixed timeout, NOT the (large)
    // scan timeout, so a down clamd doesn't make /health/ready hang for minutes.
    const clamav: boolean | "disabled" = env.CLAMAV_HOST
      ? await pingTcp(env.CLAMAV_HOST, env.CLAMAV_PORT, 2000)
      : "disabled";
    return reply.status(db ? 200 : 503).send({
      status: db ? "ready" : "not_ready",
      checks: { db, clamav },
    });
  });
}
