import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { guard } from "../../lib/auth.js";

export async function auditRoutes(app: FastifyInstance) {
  // Query the security audit trail (admins only).
  app.get("/audit", { preHandler: guard("audit:read") }, async (req) => {
    const { action, actorId, limit } = z.object({
      action: z.string().optional(),
      actorId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    }).parse(req.query);
    const data = await prisma.auditLog.findMany({
      where: { ...(action ? { action } : {}), ...(actorId ? { actorId } : {}) },
      orderBy: { at: "desc" },
      take: limit ?? 50,
    });
    return { data };
  });
}
