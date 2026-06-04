import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  OrgError, addMember, createOrganization, createOrgLearner, enrollOrgLearner, getOrganization,
  listMembers, listOrganizations, removeMember, seatUsage, setSeats, setLearnerDisabled,
} from "./organizations.service.js";
import { EngineError } from "../enrollments/enrollments.service.js";
import { provisionToken } from "../scim/scim.service.js";
import { authenticate, guard } from "../../lib/auth.js";
import { hasPermission } from "../../domain/auth/permissions.js";
import { resolveTenant, isOrgAdmin } from "../../lib/tenant.js";
import { audit } from "../../lib/audit.js";

const OrgRole = z.enum(["OWNER", "ADMIN", "MEMBER"]);

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof OrgError || err instanceof EngineError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
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

  // --- B2B licensing (seats) ---

  // Seat usage — org admins (their own org) or platform staff.
  app.get("/organizations/:id/seats", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    try { return { data: await seatUsage(id) }; } catch (err) { return handle(reply, err); }
  });

  // Set the licensed seat count — PLATFORM ONLY (an org admin must not raise its own limit).
  app.patch("/organizations/:id/seats", { preHandler: guard("org:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { seats } = z.object({ seats: z.number().int().min(0) }).parse(req.body);
    try { return { data: await setSeats(id, seats) }; } catch (err) { return handle(reply, err); }
  });

  // Create a learner in this org (enterprise self-service) — quota-enforced.
  app.post("/organizations/:id/learners", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    const body = z.object({
      name: z.string().trim().min(1),
      email: z.string().email(),
      password: z.string().min(10, "10 caractères minimum").optional(),
    }).parse(req.body);
    try {
      const user = await createOrgLearner(id, body);
      await audit({ actorId: req.principal?.id, action: "org.learner.create", targetType: "User", targetId: user.id, ip: req.ip, meta: { organizationId: id } });
      return reply.status(201).send({ data: user });
    } catch (err) { return handle(reply, err); }
  });

  // Deactivate / reactivate an org learner (frees / re-consumes a seat).
  app.patch("/organizations/:id/learners/:userId", { preHandler: authenticate }, async (req, reply) => {
    const { id, userId } = z.object({ id: z.string(), userId: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    const { disabled } = z.object({ disabled: z.boolean() }).parse(req.body);
    try {
      const r = await setLearnerDisabled(id, userId, disabled);
      await audit({ actorId: req.principal?.id, action: disabled ? "org.learner.disable" : "org.learner.enable", targetType: "User", targetId: userId, ip: req.ip, meta: { organizationId: id } });
      return { data: r };
    } catch (err) { return handle(reply, err); }
  });

  // Enrol an org learner into a course (org-scoped).
  app.post("/organizations/:id/enrollments", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    const { userId, courseId } = z.object({ userId: z.string(), courseId: z.string() }).parse(req.body);
    try {
      const e = await enrollOrgLearner(id, userId, courseId);
      await audit({ actorId: req.principal?.id, action: "org.enroll", targetType: "Enrollment", targetId: (e as { id: string }).id, ip: req.ip, meta: { organizationId: id, courseId } });
      return reply.status(201).send({ data: e });
    } catch (err) { return handle(reply, err); }
  });

  // Provision a SCIM bearer token for the org (returned once).
  app.post("/organizations/:id/scim/token", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    await getOrganization(id);
    return { data: await provisionToken(id) };
  });
}
