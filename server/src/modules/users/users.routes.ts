import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { authenticate, guard } from "../../lib/auth.js";
import { hashPassword } from "../../lib/auth/password.js";
import { audit } from "../../lib/audit.js";

const RoleEnum = z.enum([
  "LEARNER", "LEARNING_DESIGNER", "REVIEWER", "INSTRUCTOR", "EVALUATOR",
  "COURSE_ADMIN", "SUPER_ADMIN", "ENTERPRISE_CLIENT", "EMPLOYER",
]);

/** Never leak the password hash. */
const publicUser = { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true } as const;

export async function userRoutes(app: FastifyInstance) {
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

  app.get("/users/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const user = await prisma.user.findUnique({ where: { id }, select: publicUser });
    if (!user) return reply.notFound("Utilisateur introuvable");
    return { data: user };
  });
}
