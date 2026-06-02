import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { OfflineError, applySync, buildBundle } from "./offline.service.js";
import { authenticate, requireEnrollmentAccess } from "../../lib/auth.js";

const idParam = z.object({ id: z.string() });
const owned = [authenticate, requireEnrollmentAccess];

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof OfflineError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function offlineRoutes(app: FastifyInstance) {
  // Downloadable, PAM-injected course bundle (+ media manifest). ETag/304 cached.
  app.get("/enrollments/:id/offline-bundle", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try {
      const { etag, bundle } = await buildBundle(id);
      const tag = `"${etag}"`;
      reply.header("ETag", tag).header("Cache-Control", "private, max-age=0, must-revalidate");
      if (req.headers["if-none-match"] === tag) return reply.code(304).send();
      return reply.send({ data: bundle });
    } catch (err) { return handle(reply, err); }
  });

  // Replay actions queued while offline (idempotent, ordered by client time).
  app.post("/enrollments/:id/sync", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { actions } = z.object({
      actions: z.array(z.object({
        opId: z.string().min(1),
        type: z.string().min(1),
        clientTs: z.string().datetime(),
        payload: z.record(z.string(), z.unknown()).optional(),
      })).min(1).max(500),
    }).parse(req.body);
    try { return { data: await applySync(id, actions) }; } catch (err) { return handle(reply, err); }
  });
}
