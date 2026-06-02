import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  ScimError, createUser, deleteUser, getUser, listUsers, orgFromToken, patchUser, replaceUser, serviceProviderConfig,
} from "./scim.service.js";

const SCIM_CT = "application/scim+json";

declare module "fastify" { interface FastifyRequest { scimOrgId?: string } }

/** Resolve the org from the SCIM bearer token. */
async function scimAuth(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers["authorization"];
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return reply.code(401).header("content-type", SCIM_CT).send(scimErr(401, "Bearer requis"));
  try { req.scimOrgId = (await orgFromToken(token)).id; }
  catch { return reply.code(401).header("content-type", SCIM_CT).send(scimErr(401, "Jeton SCIM invalide")); }
}

const scimErr = (status: number, detail: string, scimType?: string) => ({
  schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], status: String(status), detail, ...(scimType ? { scimType } : {}),
});
function send(reply: FastifyReply, status: number, body: unknown) {
  return reply.code(status).header("content-type", SCIM_CT).send(body);
}
function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof ScimError) return send(reply, err.status, scimErr(err.status, err.message, err.scimType));
  throw err;
}

export async function scimRoutes(app: FastifyInstance) {
  // Discovery (token-authenticated).
  app.get("/scim/v2/ServiceProviderConfig", { preHandler: scimAuth }, async (_req, reply) => send(reply, 200, serviceProviderConfig()));

  // List / filter.
  app.get("/scim/v2/Users", { preHandler: scimAuth }, async (req, reply) => {
    const { filter } = z.object({ filter: z.string().optional() }).parse(req.query);
    return send(reply, 200, await listUsers(req.scimOrgId!, filter));
  });

  app.get("/scim/v2/Users/:id", { preHandler: scimAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return send(reply, 200, await getUser(req.scimOrgId!, id)); } catch (err) { return handle(reply, err); }
  });

  app.post("/scim/v2/Users", { preHandler: scimAuth }, async (req, reply) => {
    try { return send(reply, 201, await createUser(req.scimOrgId!, (req.body ?? {}) as never)); } catch (err) { return handle(reply, err); }
  });

  app.put("/scim/v2/Users/:id", { preHandler: scimAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return send(reply, 200, await replaceUser(req.scimOrgId!, id, (req.body ?? {}) as never)); } catch (err) { return handle(reply, err); }
  });

  app.patch("/scim/v2/Users/:id", { preHandler: scimAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const ops = ((req.body as { Operations?: unknown })?.Operations ?? []) as never[];
    try { return send(reply, 200, await patchUser(req.scimOrgId!, id, ops)); } catch (err) { return handle(reply, err); }
  });

  app.delete("/scim/v2/Users/:id", { preHandler: scimAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { await deleteUser(req.scimOrgId!, id); return reply.code(204).send(); } catch (err) { return handle(reply, err); }
  });
}
