import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { AccreditationError, grantAccreditation, listAccreditations, revokeAccreditation } from "./accreditations.service.js";
import { guard } from "../../lib/auth.js";
import { audit } from "../../lib/audit.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof AccreditationError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function accreditationRoutes(app: FastifyInstance) {
  // Registre (staff d'évaluation).
  app.get("/accreditations", { preHandler: guard("evaluation:assign") }, async () => ({ data: await listAccreditations() }));

  // Octroi — direction pédagogique (après calibration §9.2).
  app.post("/accreditations", { preHandler: guard("user:manage") }, async (req, reply) => {
    const { evaluatorId, courseId, notes } = z.object({
      evaluatorId: z.string(), courseId: z.string(), notes: z.string().optional(),
    }).parse(req.body);
    try {
      const row = await grantAccreditation(evaluatorId, courseId, req.principal!.id, notes);
      await audit({ actorId: req.principal!.id, action: "accreditation.grant", targetType: "User", targetId: evaluatorId, ip: req.ip, meta: { courseId, accreditationId: row.id } });
      return reply.status(201).send({ data: row });
    } catch (err) { return handle(reply, err); }
  });

  // Révocation datée (historique conservé).
  app.delete("/accreditations/:id", { preHandler: guard("user:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      const row = await revokeAccreditation(id);
      await audit({ actorId: req.principal!.id, action: "accreditation.revoke", targetType: "User", targetId: row.evaluatorId, ip: req.ip, meta: { accreditationId: id } });
      return { data: row };
    } catch (err) { return handle(reply, err); }
  });
}
