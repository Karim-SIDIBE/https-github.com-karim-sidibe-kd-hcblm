import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma.js";

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
}
