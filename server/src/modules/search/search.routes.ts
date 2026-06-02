import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { indexCourseVersion, search } from "./search.service.js";
import { guard } from "../../lib/auth.js";

export async function searchRoutes(app: FastifyInstance) {
  // Semantic search over published content.
  app.post("/search", { preHandler: guard("course:read") }, async (req) => {
    const { query, courseId, k } = z.object({
      query: z.string().trim().min(2),
      courseId: z.string().optional(),
      k: z.number().int().min(1).max(20).optional(),
    }).parse(req.body);
    return { data: await search(query, { courseId, k }) };
  });

  // Manual (re)index of a version.
  app.post("/versions/:versionId/index", { preHandler: guard("course:create") }, async (req, reply) => {
    const { versionId } = z.object({ versionId: z.string() }).parse(req.params);
    try { return { data: await indexCourseVersion(versionId) }; }
    catch { return reply.notFound("Version introuvable"); }
  });
}
