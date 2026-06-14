import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { guard } from "../../lib/auth.js";
import { RgpdError, exportUserData, eraseUser } from "./rgpd.service.js";
import { listSessions, revokeAllSessions } from "../auth/auth.service.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof RgpdError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

/** Admin-facing RGPD data-rights endpoints (data export, erasure, sessions). */
export async function rgpdRoutes(app: FastifyInstance) {
  // Art. 15 & 20 — download everything we hold about a user as JSON.
  app.get("/users/:id/export", { preHandler: guard("user:manage") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const data = await exportUserData(id);
      reply.header("content-disposition", `attachment; filename="rgpd-export-${id}.json"`);
      return reply.type("application/json").send(JSON.stringify(data, null, 2));
    } catch (err) { return handle(reply, err); }
  });

  // Art. 17 — erase a user, by anonymisation (default) or hard delete.
  app.post("/users/:id/erase", { preHandler: guard("user:manage") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { mode } = z.object({ mode: z.enum(["anonymize", "delete"]) }).parse(req.body);
    try { return { data: await eraseUser(req.principal?.id, id, mode, req.ip) }; }
    catch (err) { return handle(reply, err); }
  });

  // A user's active sessions (admin view) + force log-out everywhere (offboarding).
  app.get("/users/:id/sessions", { preHandler: guard("user:manage") }, async (req) => {
    const { id } = req.params as { id: string };
    return { data: await listSessions(id) };
  });

  app.post("/users/:id/sessions/revoke-all", { preHandler: guard("user:manage") }, async (req) => {
    const { id } = req.params as { id: string };
    return { data: await revokeAllSessions(id, { actorId: req.principal?.id, ip: req.ip }) };
  });
}
