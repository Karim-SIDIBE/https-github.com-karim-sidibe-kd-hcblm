import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  OrgError, addMember, createOrganization, getOrganization, listMembers, listOrganizations, removeMember,
} from "./organizations.service.js";
import { provisionToken } from "../scim/scim.service.js";
import { authenticate, guard } from "../../lib/auth.js";
import { hasPermission } from "../../domain/auth/permissions.js";
import { resolveTenant, isOrgAdmin } from "../../lib/tenant.js";

const OrgRole = z.enum(["OWNER", "ADMIN", "MEMBER"]);

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof OrgError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

/** May the caller administer this org? (platform org:manage, or org OWNER/ADMIN) */
async function canAdminOrg(req: FastifyRequest, orgId: string): Promise<boolean> {
  if (hasPermission(req.principal!.role, "org:manage")) return true;
  const ctx = await resolveTenant(req.principal!, orgId);
  return isOrgAdmin(ctx);
}

export async function organizationRoutes(app: FastifyInstance) {
  // Create an organization (platform-level).
  app.post("/organizations", { preHandler: guard("org:manage") }, async (req, reply) => {
    const { name, slug } = z.object({ name: z.string().trim().min(1), slug: z.string().regex(/^[a-z0-9-]+$/) }).parse(req.body);
    try { return reply.status(201).send({ data: await createOrganization(name, slug, req.principal!.id) }); }
    catch (err) { return handle(reply, err); }
  });

  app.get("/organizations", { preHandler: authenticate }, async (req) => ({ data: await listOrganizations(req.principal!) }));

  app.get("/organizations/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id)) && !(await resolveTenant(req.principal!, id))) return reply.notFound("Organisation introuvable");
    try { return { data: await getOrganization(id) }; } catch (err) { return handle(reply, err); }
  });

  // --- membership (org OWNER/ADMIN or platform org:manage) ---
  app.get("/organizations/:id/members", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    try { return { data: await listMembers(id) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/organizations/:id/members", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    const { userId, orgRole } = z.object({ userId: z.string(), orgRole: OrgRole.default("MEMBER") }).parse(req.body);
    try { return reply.status(201).send({ data: await addMember(id, userId, orgRole) }); } catch (err) { return handle(reply, err); }
  });

  app.delete("/organizations/:id/members/:userId", { preHandler: authenticate }, async (req, reply) => {
    const { id, userId } = z.object({ id: z.string(), userId: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    try { return { data: await removeMember(id, userId) }; } catch (err) { return handle(reply, err); }
  });

  // Provision a SCIM bearer token for the org (returned once).
  app.post("/organizations/:id/scim/token", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    await getOrganization(id);
    return { data: await provisionToken(id) };
  });
}
