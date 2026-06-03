import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { TutorError, ask, getSession, listSessions } from "./tutor.service.js";
import { authenticate, requireEnrollmentAccess } from "../../lib/auth.js";

const idParam = z.object({ id: z.string() });
const owned = [authenticate, requireEnrollmentAccess];

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof TutorError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function tutorRoutes(app: FastifyInstance) {
  // Ask the grounded tutor (creates or continues a session).
  app.post("/enrollments/:id/tutor/ask", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { question, sessionId } = z.object({ question: z.string().trim().min(2).max(2000), sessionId: z.string().optional() }).parse(req.body);
    try { return { data: await ask(id, question, sessionId) }; } catch (err) { return handle(reply, err); }
  });

  app.get("/enrollments/:id/tutor/sessions", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await listSessions(id) }; } catch (err) { return handle(reply, err); }
  });

  app.get("/enrollments/:id/tutor/sessions/:sessionId", { preHandler: owned }, async (req, reply) => {
    const { id, sessionId } = z.object({ id: z.string(), sessionId: z.string() }).parse(req.params);
    try { return { data: await getSession(id, sessionId) }; } catch (err) { return handle(reply, err); }
  });
}
