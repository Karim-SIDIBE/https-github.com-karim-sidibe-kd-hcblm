import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { LtiServiceError, handleLaunch, initiateLogin, listPlatforms, registerPlatform } from "./lti.service.js";
import { publicJwks } from "../../lib/auth/keys.js";
import { env } from "../../config/env.js";
import { guard } from "../../lib/auth.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof LtiServiceError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

const loginSchema = z.object({
  iss: z.string(),
  client_id: z.string().optional(),
  login_hint: z.string(),
  target_link_uri: z.string().optional(),
  lti_message_hint: z.string().optional(),
});

export async function ltiRoutes(app: FastifyInstance) {
  // Tool JWKS (platform verifies our signed messages, e.g. Deep Linking).
  app.get("/lti/jwks", async () => publicJwks());

  // Minimal tool configuration.
  app.get("/lti/config", async () => {
    const base = env.PUBLIC_BASE_URL.replace(/\/$/, "");
    return {
      title: "Kompetences Declick",
      oidc_initiation_url: `${base}/api/v1/lti/login`,
      target_link_uri: `${base}/api/v1/lti/launch`,
      jwks_uri: `${base}/api/v1/lti/jwks`,
    };
  });

  // --- platform registration (admin) ---
  app.post("/lti/platforms", { preHandler: guard("lti:manage") }, async (req, reply) => {
    const body = z.object({
      name: z.string().optional(), issuer: z.string().url(), clientId: z.string().min(1),
      deploymentId: z.string().optional(), authLoginUrl: z.string().url(), jwksUrl: z.string().url(), tokenUrl: z.string().url().optional(),
    }).parse(req.body);
    return reply.status(201).send({ data: await registerPlatform({ ...body, createdById: req.principal?.id }) });
  });

  app.get("/lti/platforms", { preHandler: guard("lti:manage") }, async () => ({ data: await listPlatforms() }));

  // --- OIDC third-party login initiation (GET or POST per spec) ---
  const login = async (req: import("fastify").FastifyRequest, reply: FastifyReply) => {
    const src = (req.method === "GET" ? req.query : req.body) as Record<string, unknown>;
    const p = loginSchema.parse(src);
    try {
      const url = await initiateLogin({ iss: p.iss, clientId: p.client_id, loginHint: p.login_hint, targetLinkUri: p.target_link_uri, ltiMessageHint: p.lti_message_hint });
      return reply.redirect(url);
    } catch (err) { return handle(reply, err); }
  };
  app.get("/lti/login", login);
  app.post("/lti/login", login);

  // --- launch (platform form_posts the id_token) ---
  app.post("/lti/launch", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const idToken = typeof body.id_token === "string" ? body.id_token : "";
    const state = typeof body.state === "string" ? body.state : "";
    try { return await handleLaunch(idToken, state, req.ip); } catch (err) { return handle(reply, err); }
  });
}
