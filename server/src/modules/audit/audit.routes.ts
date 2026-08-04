import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { guard } from "../../lib/auth.js";
import { envelope, pageQuery } from "../../lib/paging.js";
import { toCsv } from "../analytics/analytics.service.js";

/** Resolve actor ids to names/e-mails (AuditLog.actorId is plain text, no FK —
 *  history must survive account deletion, so we join in memory). */
async function actorMap(ids: (string | null)[]): Promise<Map<string, { name: string; email: string }>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, email: true } });
  return new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));
}

export async function auditRoutes(app: FastifyInstance) {
  // Query the security audit trail (admins only).
  // Paged: ?q=&action=&actorId=&page=&pageSize= → { data, total, page, pageSize }.
  // `limit` is kept for legacy callers (acts as pageSize of page 1).
  // ?format=csv exports the FULL filtered set (capped at 10 000 rows).
  app.get("/audit", { preHandler: guard("audit:read") }, async (req, reply) => {
    const query = pageQuery.extend({
      action: z.string().optional(),
      actorId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
      format: z.enum(["csv", "json"]).optional(),
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

    if (query.format === "csv") {
      const rows = await prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, take: 10_000 });
      const actors = await actorMap(rows.map((r) => r.actorId));
      const csv = toCsv(rows.map((r) => ({
        date: r.at.toISOString(),
        action: r.action,
        acteur: r.actorId ? (actors.get(r.actorId)?.email ?? r.actorId) : "",
        cibleType: r.targetType ?? "",
        cibleId: r.targetId ?? "",
        ip: r.ip ?? "",
        meta: r.meta ? JSON.stringify(r.meta) : "",
      })));
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", `attachment; filename="journal-audit.csv"`);
      return reply.send("﻿" + csv); // BOM so Excel reads UTF-8 accents
    }

    const pageSize = query.limit ?? query.pageSize;
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (query.page - 1) * pageSize, take: pageSize }),
    ]);
    const actors = await actorMap(rows.map((r) => r.actorId));
    const data = rows.map((r) => ({ ...r, actor: r.actorId ? (actors.get(r.actorId) ?? null) : null }));
    return envelope(data, total, query.page, pageSize);
  });

  // Distinct action strings present in the log (for the filter dropdown).
  app.get("/audit/actions", { preHandler: guard("audit:read") }, async () => {
    const rows = await prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });
    return { data: rows.map((r) => r.action) };
  });
}
