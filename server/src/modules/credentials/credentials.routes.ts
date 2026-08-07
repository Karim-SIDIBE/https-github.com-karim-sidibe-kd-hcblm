import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  CredentialError, certificate, hostedAssertionDoc, listAllCredentials, listForEnrollment, revoke, unrevoke, vcJwt, verificationData, verify,
} from "./credentials.service.js";
import { issuerDocument } from "../../lib/credentials/openbadge.js";
import { renderCredentialPage, renderNotFoundPage } from "../../lib/credentials/page.js";
import { audit } from "../../lib/audit.js";
import { authenticate, guard, requireEnrollmentAccess } from "../../lib/auth.js";
import { isStaff } from "../../domain/auth/permissions.js";
import { envelope, pageQuery } from "../../lib/paging.js";

const owned = [authenticate, requireEnrollmentAccess];

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof CredentialError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function credentialRoutes(app: FastifyInstance) {
  // --- admin: list all issued credentials (staff only) ---
  // Paged: ?q=&status=(valid|revoked)&page=&pageSize= → { data, total, valid, revoked, ... }.
  app.get("/credentials", { preHandler: authenticate }, async (req, reply) => {
    if (!isStaff(req.principal!.role)) return reply.status(403).send({ error: "forbidden", message: "Réservé au personnel" });
    const query = pageQuery.extend({ status: z.enum(["valid", "revoked"]).optional() }).parse(req.query ?? {});
    const paged = "page" in ((req.query ?? {}) as object) || "pageSize" in ((req.query ?? {}) as object);
    const pageSize = paged ? query.pageSize : 500;
    const { rows, total, valid, revoked } = await listAllCredentials({ q: query.q, status: query.status, page: query.page, pageSize });
    return envelope(rows, total, query.page, pageSize, { valid, revoked });
  });

  // --- public (verifiers / anyone): issuer, badge class, hosted assertion, VC, verify ---
  app.get("/credentials/issuer", async () => issuerDocument());

  // The URL printed in every certificate's QR code. Content-negotiated:
  // browsers (someone scanning the QR) get a human verification page; API
  // clients and Open Badge validators keep the assertion JSON at the exact
  // hosted URL the spec requires. `?format=json` forces JSON from a browser.
  app.get("/credentials/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { format } = z.object({ format: z.enum(["json"]).optional() }).parse(req.query ?? {});
    const wantsHtml = !format && (req.headers.accept ?? "").includes("text/html");
    if (!wantsHtml) {
      try { return await hostedAssertionDoc(id); } catch (err) { return handle(reply, err); }
    }
    try {
      const page = renderCredentialPage(await verificationData(id));
      return reply.header("content-type", "text/html; charset=utf-8").send(page);
    } catch (err) {
      if (err instanceof CredentialError && err.statusCode === 404) {
        return reply.status(404).header("content-type", "text/html; charset=utf-8").send(renderNotFoundPage());
      }
      throw err;
    }
  });

  app.get("/credentials/:id/vc", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return reply.header("content-type", "application/jwt").send(await vcJwt(id)); } catch (err) { return handle(reply, err); }
  });

  app.post("/credentials/verify", async (req, reply) => {
    const body = z.object({ jws: z.string().optional(), credentialId: z.string().optional() }).parse(req.body ?? {});
    try { return await verify(body); } catch (err) { return handle(reply, err); }
  });

  // Convenience GET verify for QR/links. Browsers are sent to the human page.
  app.get("/credentials/:id/verify", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if ((req.headers.accept ?? "").includes("text/html")) return reply.redirect(`/api/v1/credentials/${encodeURIComponent(id)}`);
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

  // Reinstate a wrongly-revoked credential (same permission as revoking).
  app.post("/credentials/:id/unrevoke", { preHandler: guard("credential:revoke") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      const r = await unrevoke(id);
      await audit({ actorId: req.principal?.id, action: "credential.unrevoke", targetType: "credential", targetId: id, ip: req.ip });
      return { data: r };
    } catch (err) { return handle(reply, err); }
  });
}
