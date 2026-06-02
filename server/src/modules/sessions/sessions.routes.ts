import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  SessionError, cancelSession, createSession, getSession, listSessions, markAttendance, register, roster,
} from "./sessions.service.js";
import { authenticate, guard } from "../../lib/auth.js";
import { isStaff } from "../../domain/auth/permissions.js";

const idParam = z.object({ id: z.string() });

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof SessionError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function sessionRoutes(app: FastifyInstance) {
  // List / detail (any authenticated user)
  app.get("/sessions", { preHandler: authenticate }, async (req) => {
    const { courseId, upcoming } = z.object({ courseId: z.string().optional(), upcoming: z.coerce.boolean().optional() }).parse(req.query);
    return { data: await listSessions({ courseId, upcoming }) };
  });

  app.get("/sessions/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await getSession(id) }; } catch (err) { return handle(reply, err); }
  });

  // Create (host / staff)
  app.post("/sessions", { preHandler: guard("session:manage") }, async (req, reply) => {
    const body = z.object({
      title: z.string().trim().min(1),
      description: z.string().optional(),
      provider: z.enum(["ZOOM", "TEAMS", "MANUAL"]).default("MANUAL"),
      startsAt: z.coerce.date(),
      durationMin: z.number().int().positive().max(600),
      timezone: z.string().optional(),
      capacity: z.number().int().positive().optional(),
      courseId: z.string().optional(),
      joinUrl: z.string().url().optional(),
    }).parse(req.body);
    try {
      const session = await createSession(body, req.principal!.id);
      return reply.status(201).send({ data: session });
    } catch (err) { return handle(reply, err); }
  });

  // Register (self, or staff on behalf)
  app.post("/sessions/:id/register", { preHandler: authenticate }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { userId } = z.object({ userId: z.string().optional() }).parse(req.body ?? {});
    const p = req.principal!;
    const target = userId ?? p.id;
    if (target !== p.id && !isStaff(p.role)) {
      return reply.status(403).send({ error: "forbidden", message: "Vous ne pouvez inscrire que vous-même" });
    }
    try { return reply.status(201).send({ data: await register(id, target) }); } catch (err) { return handle(reply, err); }
  });

  // Roster (host / staff)
  app.get("/sessions/:id/registrations", { preHandler: guard("session:manage") }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await roster(id) }; } catch (err) { return handle(reply, err); }
  });

  // Mark attendance (host / staff)
  app.post("/sessions/:id/attendance", { preHandler: guard("session:manage") }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { entries } = z.object({
      entries: z.array(z.object({ userId: z.string(), minutes: z.number().int().min(0).optional() })).min(1),
    }).parse(req.body);
    try { return { data: await markAttendance(id, entries) }; } catch (err) { return handle(reply, err); }
  });

  // Cancel (host / staff)
  app.post("/sessions/:id/cancel", { preHandler: guard("session:manage") }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await cancelSession(id) }; } catch (err) { return handle(reply, err); }
  });
}
