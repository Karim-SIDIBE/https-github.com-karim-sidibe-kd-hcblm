/**
 * views.routes.ts — per-user saved views of the admin list screens.
 *
 * A view is a named JSON blob of screen state (filters, columns, sort…).
 * Strictly per-user: you only ever see and touch your own views, so a plain
 * `authenticate` is enough — no extra permission needed.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { authenticate } from "../../lib/auth.js";

const SCREEN = z.string().trim().min(1).max(40);
const NAME = z.string().trim().min(1).max(60);

export async function viewsRoutes(app: FastifyInstance) {
  app.get("/views", { preHandler: authenticate }, async (req) => {
    const { screen } = z.object({ screen: SCREEN }).parse(req.query ?? {});
    const data = await prisma.savedView.findMany({
      where: { userId: req.principal!.id, screen },
      orderBy: { name: "asc" },
      select: { id: true, name: true, config: true, updatedAt: true },
    });
    return { data };
  });

  // Create or update (upsert by name — saving under an existing name replaces it).
  app.put("/views", { preHandler: authenticate }, async (req) => {
    const { screen, name, config } = z.object({
      screen: SCREEN, name: NAME, config: z.record(z.unknown()),
    }).parse(req.body);
    const userId = req.principal!.id;
    const data = await prisma.savedView.upsert({
      where: { userId_screen_name: { userId, screen, name } },
      create: { userId, screen, name, config: config as object },
      update: { config: config as object },
      select: { id: true, name: true, config: true, updatedAt: true },
    });
    return { data };
  });

  app.delete("/views/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { count } = await prisma.savedView.deleteMany({ where: { id, userId: req.principal!.id } });
    if (count === 0) return reply.notFound("Vue introuvable");
    return { data: { id } };
  });
}
