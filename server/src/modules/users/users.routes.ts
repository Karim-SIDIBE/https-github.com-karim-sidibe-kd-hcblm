import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { authenticate, guard } from "../../lib/auth.js";
import { hashPassword } from "../../lib/auth/password.js";
import { audit } from "../../lib/audit.js";
import { UserError, inviteUser, deleteUser, listUsers } from "./users.service.js";

const RoleEnum = z.enum([
  "LEARNER", "LEARNING_DESIGNER", "REVIEWER", "INSTRUCTOR", "EVALUATOR",
  "COURSE_ADMIN", "SUPER_ADMIN", "ENTERPRISE_CLIENT", "EMPLOYER",
]);

/** Never leak the password hash. */
const publicUser = { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true } as const;

export async function userRoutes(app: FastifyInstance) {
  // List all accounts (staff) — incl. self-registered users not yet enrolled.
  app.get("/users", { preHandler: guard("user:manage") }, async (req) => {
    const { q } = z.object({ q: z.string().optional() }).parse(req.query ?? {});
    return { data: await listUsers(q) };
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

  app.get("/users/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const user = await prisma.user.findUnique({ where: { id }, select: publicUser });
    if (!user) return reply.notFound("Utilisateur introuvable");
    return { data: user };
  });
}
