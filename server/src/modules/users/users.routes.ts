import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { authenticate, guard } from "../../lib/auth.js";
import { hasPermission } from "../../domain/auth/permissions.js";
import { hashPassword } from "../../lib/auth/password.js";
import { audit } from "../../lib/audit.js";
import { UserError, USER_SORTS, importUsers, inviteUser, deleteUser, listUsers, updateUser } from "./users.service.js";
import { envelope, pageQuery, sortSpec } from "../../lib/paging.js";

const RoleEnum = z.enum([
  "LEARNER", "LEARNING_DESIGNER", "REVIEWER", "INSTRUCTOR", "EVALUATOR",
  "COURSE_ADMIN", "SUPER_ADMIN", "ENTERPRISE_CLIENT", "EMPLOYER",
]);

/** Never leak the password hash. */
const publicUser = { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true } as const;

export async function userRoutes(app: FastifyInstance) {
  // List all accounts (staff) — incl. self-registered users not yet enrolled.
  // Paged: ?q=&page=&pageSize=&sort=name:asc → { data, total, page, pageSize }.
  app.get("/users", { preHandler: guard("user:manage") }, async (req) => {
    const query = pageQuery.parse(req.query ?? {});
    // Legacy callers (people pickers) send no page → serve a large first page.
    const pageSize = "page" in ((req.query ?? {}) as object) || "pageSize" in ((req.query ?? {}) as object) ? query.pageSize : 500;
    const sort = sortSpec(query.sort, USER_SORTS, { field: "createdAt", dir: "desc" });
    const { rows, total } = await listUsers({ q: query.q, page: query.page, pageSize, sort });
    return envelope(rows, total, query.page, pageSize);
  });

  app.post("/users", { preHandler: guard("user:manage") }, async (req, reply) => {
    const body = z.object({
      email: z.string().email(),
      name: z.string().trim().min(1),
      role: RoleEnum.optional(),
      password: z.string().min(10, "10 caractères minimum").optional(),
    }).parse(req.body);
    try {
      const user = await prisma.user.create({
        data: {
          email: body.email, name: body.name, role: body.role ?? "LEARNER",
          passwordHash: body.password ? await hashPassword(body.password) : null,
          emailVerifiedAt: new Date(), // staff-created → trusted/verified
        },
        select: publicUser,
      });
      await audit({ actorId: req.principal?.id, action: "user.create", targetType: "User", targetId: user.id, ip: req.ip, meta: { role: user.role } });
      return reply.status(201).send({ data: user });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        return reply.conflict("Un utilisateur avec cet email existe déjà");
      throw e;
    }
  });

  // (Re)send the access invitation: set a fresh temp password + deliver it.
  app.post("/users/:id/invite", { preHandler: guard("user:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { password } = z.object({ password: z.string().min(10).optional() }).parse(req.body ?? {});
    try {
      const r = await inviteUser(id, password);
      await audit({ actorId: req.principal?.id, action: "user.invite", targetType: "User", targetId: id, ip: req.ip, meta: { delivered: r.delivered } });
      return { data: r };
    } catch (e) {
      if (e instanceof UserError) return reply.status(e.statusCode).send({ error: e.code, message: e.message });
      throw e;
    }
  });

  // Bulk import (staff): rows parsed from a CSV by the admin. Row-independent —
  // per-line errors are reported, the rest goes through. Optional course
  // enrolment + invitation e-mail. Max 500 rows per call.
  app.post("/users/import", { preHandler: guard("user:manage") }, async (req, reply) => {
    const body = z.object({
      rows: z.array(z.object({ name: z.string().optional(), email: z.string().optional(), role: z.string().optional() })).min(1).max(500),
      courseId: z.string().optional(),
      invite: z.boolean().optional(),
    }).parse(req.body);
    try {
      const report = await importUsers(body.rows, { courseId: body.courseId, invite: body.invite });
      await audit({
        actorId: req.principal?.id, action: "user.import", targetType: "User", ip: req.ip,
        meta: { total: report.total, created: report.created, existing: report.existing, enrolled: report.enrolled, errors: report.errors.length },
      });
      return { data: report };
    } catch (e) {
      if (e instanceof UserError) return reply.status(e.statusCode).send({ error: e.code, message: e.message });
      throw e;
    }
  });

  // Edit an account (staff): name, e-mail, role, activation, password reset.
  app.patch("/users/:id", { preHandler: guard("user:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({
      name: z.string().trim().min(1).optional(),
      email: z.string().email().optional(),
      role: RoleEnum.optional(),
      disabled: z.boolean().optional(),
      password: z.string().min(10, "10 caractères minimum").optional(),
    }).parse(req.body ?? {});
    try {
      const user = await updateUser(req.principal?.id, id, body);
      await audit({
        actorId: req.principal?.id, action: "user.update", targetType: "User", targetId: id, ip: req.ip,
        meta: { fields: Object.keys(body).map((k) => (k === "password" ? "password(reset)" : k)) },
      });
      return { data: user };
    } catch (e) {
      if (e instanceof UserError) return reply.status(e.statusCode).send({ error: e.code, message: e.message });
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        return reply.conflict("Un utilisateur avec cet email existe déjà");
      throw e;
    }
  });

  // Hard-delete a user (staff). Cascades enrolments/tokens/memberships; audit kept.
  app.delete("/users/:id", { preHandler: guard("user:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      const r = await deleteUser(req.principal?.id, id);
      await audit({ actorId: req.principal?.id, action: "user.delete", targetType: "User", targetId: id, ip: req.ip, meta: { email: r.email } });
      return { data: r };
    } catch (e) {
      if (e instanceof UserError) return reply.status(e.statusCode).send({ error: e.code, message: e.message });
      throw e;
    }
  });

  // A single user's record. Restricted to self or staff (user:manage): otherwise
  // any authenticated learner could walk ids and harvest every user's e-mail/role.
  app.get("/users/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const p = req.principal!;
    if (id !== p.id && !hasPermission(p.role, "user:manage")) {
      return reply.status(403).send({ error: "forbidden", message: "Accès réservé au titulaire du compte ou au staff" });
    }
    const user = await prisma.user.findUnique({ where: { id }, select: publicUser });
    if (!user) return reply.notFound("Utilisateur introuvable");
    return { data: user };
  });
}
