import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/auth.js";
import { RgpdError, exportUserData, requestOwnErasure } from "../rgpd/rgpd.service.js";
import { listConsents, setConsent } from "../consent/consent.service.js";
import { isConsentType } from "../../domain/consent.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof RgpdError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

/** Authenticated self-service (RGPD data rights for the logged-in user, incl. learners). */
export async function meRoutes(app: FastifyInstance) {
  // Art. 15 & 20 — export my own data as a JSON download.
  app.get("/me/export", { preHandler: authenticate }, async (req, reply) => {
    const data = await exportUserData(req.principal!.id);
    reply.header("content-disposition", `attachment; filename="mes-donnees.json"`);
    return reply.type("application/json").send(JSON.stringify(data, null, 2));
  });

  // Art. 17 — request erasure of my own account (scheduled, grace period applies).
  app.post("/me/delete-account", { preHandler: authenticate }, async (req, reply) => {
    const { mode } = z.object({ mode: z.enum(["anonymize", "delete"]).default("anonymize") }).parse(req.body ?? {});
    try { return { data: await requestOwnErasure(req.principal!.id, mode, req.ip) }; }
    catch (err) { return handle(reply, err); }
  });

  // Consents — view current state, grant/revoke.
  app.get("/me/consents", { preHandler: authenticate }, async (req) => ({ data: await listConsents(req.principal!.id) }));

  app.post("/me/consents", { preHandler: authenticate }, async (req, reply) => {
    const { type, granted } = z.object({ type: z.string(), granted: z.boolean() }).parse(req.body);
    if (!isConsentType(type)) return reply.status(400).send({ error: "bad_type", message: "Type de consentement inconnu" });
    if ((type === "terms" || type === "privacy") && !granted)
      return reply.status(400).send({ error: "required_consent", message: "Retirer ce consentement revient à supprimer le compte — utilisez « Supprimer mon compte »." });
    return { data: await setConsent(req.principal!.id, type, granted, req.ip) };
  });
}
