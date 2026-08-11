import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  OrgError, addMember, addMemberByEmail, createOrganization, createOrgLearner, enrollOrgLearner, getOrganization,
  importOrgLearners, listMembers, listOrganizations, orgKpis, orgProgress, removeMember, seatUsage, setSeats, setLearnerDisabled,
} from "./organizations.service.js";
import { inviteUser } from "../users/users.service.js";
import { toCsv } from "../analytics/analytics.service.js";
import { prisma } from "../../db/prisma.js";
import { EngineError } from "../enrollments/enrollments.service.js";
import { provisionToken } from "../scim/scim.service.js";
import { authenticate, guard } from "../../lib/auth.js";
import { hasPermission } from "../../domain/auth/permissions.js";
import { resolveTenant, isOrgAdmin } from "../../lib/tenant.js";
import { audit } from "../../lib/audit.js";
import { sendMultichannel } from "../../lib/notify/send.js";
import { invitationMessage } from "../../lib/notify/templates.js";

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

  // Attach a member by id OR e-mail (the portal's team form uses e-mail).
  app.post("/organizations/:id/members", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    const body = z.object({
      userId: z.string().optional(),
      email: z.string().email().optional(),
      orgRole: OrgRole.default("MEMBER"),
    }).refine((b) => b.userId || b.email, { message: "userId ou email requis" }).parse(req.body);
    try {
      const data = body.userId
        ? await addMember(id, body.userId, body.orgRole)
        : (await addMemberByEmail(id, body.email!, body.orgRole)).membership;
      await audit({ actorId: req.principal?.id, action: "org.member.add", targetType: "User", targetId: data.userId, ip: req.ip, meta: { organizationId: id, orgRole: body.orgRole } });
      return reply.status(201).send({ data });
    } catch (err) { return handle(reply, err); }
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
  // Sends an invitation (e-mail + WhatsApp when a phone is given) unless invite:false.
  app.post("/organizations/:id/learners", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    const body = z.object({
      name: z.string().trim().min(1),
      email: z.string().email(),
      password: z.string().min(10, "10 caractères minimum").optional(),
      phone: z.string().trim().min(1).optional(),
      invite: z.boolean().default(true),
    }).parse(req.body);
    try {
      const user = await createOrgLearner(id, body);
      let invited = false;
      if (body.invite) {
        // Non-fatal: a delivery failure must not roll back the created account.
        try {
          const org = await getOrganization(id);
          const msg = invitationMessage({ name: body.name, orgName: org.name, email: body.email, tempPassword: body.password });
          const results = await sendMultichannel({ email: body.email, phone: body.phone, subject: msg.subject, body: msg.body, mobileBody: msg.mobileBody });
          invited = results.some((r) => r.ok && r.provider !== "console");
        } catch { /* delivery best-effort */ }
      }
      await audit({ actorId: req.principal?.id, action: "org.learner.create", targetType: "User", targetId: user.id, ip: req.ip, meta: { organizationId: id, invited } });
      return reply.status(201).send({ data: { ...user, invited } });
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

  // Bulk learner import (portal CSV) — seat-aware, row-independent report.
  app.post("/organizations/:id/learners/import", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    const body = z.object({
      rows: z.array(z.object({ name: z.string().optional(), email: z.string().optional() })).min(1).max(200),
      courseId: z.string().optional(),
      invite: z.boolean().optional(),
    }).parse(req.body);
    try {
      const report = await importOrgLearners(id, body.rows, { courseId: body.courseId, invite: body.invite });
      await audit({
        actorId: req.principal?.id, action: "org.learner.import", targetType: "Organization", targetId: id, ip: req.ip,
        meta: { total: report.total, created: report.created, enrolled: report.enrolled, errors: report.errors.length },
      });
      return { data: report };
    } catch (err) { return handle(reply, err); }
  });

  // KPIs agrégés de l'organisation (tableau de bord DRH) : effectif, activité,
  // progression moyenne, répartition par bloc, certification, badges, inactifs.
  // ?format=csv exporte les agrégats à plat pour les comités.
  app.get("/organizations/:id/kpis", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    const { format } = z.object({ format: z.enum(["csv", "json"]).optional() }).parse(req.query ?? {});
    try {
      const k = await orgKpis(id);
      if (format === "csv") {
        const flat = [
          { indicateur: "Licences utilisées", valeur: `${k.seats.used}/${k.seats.total}` },
          { indicateur: "Apprenants (actifs)", valeur: k.members },
          { indicateur: "Apprenants inscrits à un parcours", valeur: k.enrolled },
          { indicateur: "Inscriptions", valeur: k.enrollments },
          { indicateur: "Actifs 7 derniers jours", valeur: k.active7d },
          { indicateur: "Progression moyenne (%)", valeur: k.avgProgressPct ?? "" },
          { indicateur: "En Bloc 0 / 1 / 2 / 3 / 4 / terminé", valeur: k.blockDistribution.join(" / ") },
          { indicateur: "Certifiés", valeur: k.certified },
          { indicateur: "Taux de certification (%)", valeur: k.certificationRatePct ?? "" },
          { indicateur: "Badges de bloc obtenus", valeur: k.badges },
          { indicateur: "Certificats délivrés", valeur: k.certificates },
          { indicateur: "Inactifs depuis 14 jours ou plus", valeur: k.inactive14d.map((r) => `${r.name} (${r.inactiveDays} j)`).join(" · ") || "aucun" },
        ];
        reply.header("content-type", "text/csv; charset=utf-8");
        reply.header("content-disposition", `attachment; filename="kpis-organisation.csv"`);
        return reply.send("﻿" + toCsv(flat));
      }
      return { data: k };
    } catch (err) { return handle(reply, err); }
  });

  // Learner progress across the organization (ENT): every MEMBER's enrolments
  // with % progress, status, last activity. ?format=csv exports flat rows.
  app.get("/organizations/:id/progress", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    const { format } = z.object({ format: z.enum(["csv", "json"]).optional() }).parse(req.query ?? {});
    try {
      const rows = await orgProgress(id);
      if (format === "csv") {
        const flat = rows.flatMap((u) => (u.enrollments.length ? u.enrollments : [null]).map((e) => ({
          apprenant: u.name, email: u.email, compte: u.disabled ? "désactivé" : "actif",
          parcours: e?.courseTitle ?? "", progressionPct: e?.progressPercent ?? "", statut: e?.status ?? "",
          derniereActivite: e?.lastActivity ? new Date(e.lastActivity).toISOString() : "",
        })));
        reply.header("content-type", "text/csv; charset=utf-8");
        reply.header("content-disposition", `attachment; filename="progression-apprenants.csv"`);
        return reply.send("﻿" + toCsv(flat)); // BOM for Excel
      }
      return { data: rows };
    } catch (err) { return handle(reply, err); }
  });

  // Resend the access invitation to an org learner (fresh temp password).
  app.post("/organizations/:id/learners/:userId/invite", { preHandler: authenticate }, async (req, reply) => {
    const { id, userId } = z.object({ id: z.string(), userId: z.string() }).parse(req.params);
    if (!(await canAdminOrg(req, id))) return reply.forbidden("Réservé aux administrateurs de l'organisation");
    const member = await prisma.organizationMembership.findFirst({ where: { organizationId: id, userId } });
    if (!member) return reply.notFound("Apprenant introuvable dans cette organisation");
    try {
      const r = await inviteUser(userId);
      await audit({ actorId: req.principal?.id, action: "org.learner.invite", targetType: "User", targetId: userId, ip: req.ip, meta: { organizationId: id, delivered: r.delivered } });
      return { data: { delivered: r.delivered, tempPassword: r.tempPassword } };
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
