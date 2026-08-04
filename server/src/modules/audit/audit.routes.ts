import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { guard } from "../../lib/auth.js";
import { envelope, pageQuery } from "../../lib/paging.js";

export async function auditRoutes(app: FastifyInstance) {
  // Query the security audit trail (admins only).
  // Paged: ?q=&action=&actorId=&page=&pageSize= → { data, total, page, pageSize }.
  // `limit` is kept for legacy callers (acts as pageSize of page 1).
  app.get("/audit", { preHandler: guard("audit:read") }, async (req) => {
    const query = pageQuery.extend({
      action: z.string().optional(),
      actorId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    }).parse(req.query ?? {});
    const term = query.q?.trim();
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(term
        ? {
            OR: [
              { action: { contains: term, mode: "insensitive" as const } },
              { targetType: { contains: term, mode: "insensitive" as const } },
              { targetId: { contains: term, mode: "insensitive" as const } },
              { ip: { contains: term, mode: "insensitive" as const } },
              { actorId: { contains: term, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const pageSize = query.limit ?? query.pageSize;
    const [total, data] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (query.page - 1) * pageSize, take: pageSize }),
    ]);
    return envelope(data, total, query.page, pageSize);
  });
}
