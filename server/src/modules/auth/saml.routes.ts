import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env, samlEnabled } from "../../config/env.js";
import { getLoginUrl, metadata, validateAcs } from "../../lib/auth/saml.js";
import { AuthError, federatedLogin } from "./auth.service.js";

export async function samlRoutes(app: FastifyInstance) {
  // SP metadata XML — give this to the IdP to configure the integration.
  app.get("/auth/saml/metadata", async (_req, reply) => {
    if (!samlEnabled) return reply.notFound("SAML non configuré");
    return reply.header("content-type", "application/xml").send(metadata());
  });

  // SP-initiated login → redirect to the IdP with an AuthnRequest.
  app.get("/auth/saml/login", async (req, reply) => {
    if (!samlEnabled) return reply.notFound("SAML non configuré");
    const { relayState } = z.object({ relayState: z.string().optional() }).parse(req.query);
    return reply.redirect(await getLoginUrl(relayState ?? ""));
  });

  // Assertion Consumer Service — the IdP POSTs the signed SAMLResponse here.
  app.post("/auth/saml/acs", async (req, reply) => {
    if (!samlEnabled) return reply.notFound("SAML non configuré");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const samlResponse = typeof body.SAMLResponse === "string" ? body.SAMLResponse : null;
    if (!samlResponse) return reply.badRequest("SAMLResponse manquant");
    try {
      const profile = await validateAcs(samlResponse);
      if (!profile.email) return reply.status(400).send({ error: "no_email", message: "L'assertion SAML ne contient pas d'email" });
      const tokens = await federatedLogin({ email: profile.email, name: profile.name, jit: env.SAML_JIT_PROVISION, via: "saml", ip: req.ip });
      return tokens; // production browser flow would redirect to the SPA carrying these
    } catch (err) {
      if (err instanceof AuthError) return reply.status(401).send({ error: err.code, message: err.message });
      return reply.status(401).send({ error: "saml_invalid", message: err instanceof Error ? err.message : "Assertion SAML invalide" });
    }
  });
}
