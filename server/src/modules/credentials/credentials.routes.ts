import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  CredentialError, certificate, hostedAssertionDoc, listAllCredentials, listForEnrollment, revoke, vcJwt, verify,
} from "./credentials.service.js";
import { issuerDocument } from "../../lib/credentials/openbadge.js";
import { audit } from "../../lib/audit.js";
import { authenticate, guard, requireEnrollmentAccess } from "../../lib/auth.js";
import { isStaff } from "../../domain/auth/permissions.js";

const owned = [authenticate, requireEnrollmentAccess];

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof CredentialError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function credentialRoutes(app: FastifyInstance) {
  // --- admin: list all issued credentials (staff only) ---
  app.get("/credentials", { preHandler: authenticate }, async (req, reply) => {
    if (!isStaff(req.principal!.role)) return reply.status(403).send({ error: "forbidden", message: "Réservé au personnel" });
    return { data: await listAllCredentials() };
  });

  // --- public (verifiers / anyone): issuer, badge class, hosted assertion, VC, verify ---
  app.get("/credentials/issuer", async () => issuerDocument());

  app.get("/credentials/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return await hostedAssertionDoc(id); } catch (err) { return handle(reply, err); }
  });

  app.get("/credentials/:id/vc", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return reply.header("content-type", "application/jwt").send(await vcJwt(id)); } catch (err) { return handle(reply, err); }
  });

  app.post("/credentials/verify", async (req, reply) => {
    const body = z.object({ jws: z.string().optional(), credentialId: z.string().optional() }).parse(req.body ?? {});
    try { return await verify(body); } catch (err) { return handle(reply, err); }
  });

  // Convenience GET verify for QR/links.
  app.get("/credentials/:id/verify", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return await verify({ credentialId: id }); } catch (err) { return handle(reply, err); }
  });

  // --- authenticated: certificate PDF (the id acts as a capability) ---
  app.get("/credentials/:id/certificate.pdf", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      const pdf = await certificate(id);
      return reply.header("content-type", "application/pdf")
        .header("content-disposition", `inline; filename="certificat-${id}.pdf"`).send(pdf);
    } catch (err) { return handle(reply, err); }
  });

  // --- learner: list own credentials ---
  app.get("/enrollments/:id/credentials", { preHandler: owned }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await listForEnrollment(id) }; } catch (err) { return handle(reply, err); }
  });

  // --- admin: revoke ---
  app.post("/credentials/:id/revoke", { preHandler: guard("credential:revoke") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body ?? {});
    try {
      const r = await revoke(id, reason, req.principal?.id);
      await audit({ actorId: req.principal?.id, action: "credential.revoke", targetType: "credential", targetId: id, ip: req.ip, meta: { reason } });
      return { data: r };
    } catch (err) { return handle(reply, err); }
  });
}
