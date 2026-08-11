/**
 * appeals.routes.ts — recours (§10) et double notation de surveillance (§9.3).
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  AppealError, assignAppealEvaluator, assignDoubleMarking, getAppeal, gradeAppeal,
  gradeDoubleMarking, listAppeals, listDoubleMarkings, openAppeal, resolveDoubleMarking,
} from "./appeals.service.js";
import { authenticate, authorize, requireEnrollmentAccess } from "../../lib/auth.js";

const idParam = z.object({ id: z.string() });
const scoresBody = z.object({
  criteria: z.array(z.object({
    label: z.string().optional(), index: z.number().int().min(0).optional(),
    points: z.number().int().min(0), evidence: z.string().optional(),
  })).min(1),
});

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof AppealError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function appealsRoutes(app: FastifyInstance) {
  // Étape 1 — le candidat conteste par écrit (15 jours calendaires).
  app.post("/enrollments/:id/appeal", { preHandler: [authenticate, requireEnrollmentAccess] }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({
      contestedCriteria: z.array(z.string().min(1)).min(1),
      statement: z.string().min(1),
    }).parse(req.body);
    try { return reply.status(201).send({ data: await openAppeal(id, req.principal!.id, body) }); }
    catch (err) { return handle(reply, err); }
  });

  // Suivi candidat (jamais les scores intermédiaires — notation à l'aveugle).
  app.get("/enrollments/:id/appeal", { preHandler: [authenticate, requireEnrollmentAccess] }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await getAppeal(id) }; } catch (err) { return handle(reply, err); }
  });

  // Étapes 2 et 4 — désignation du second, puis du troisième évaluateur.
  app.post("/enrollments/:id/appeal/assign", { preHandler: [authenticate, authorize("evaluation:assign")] }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { evaluatorId } = z.object({ evaluatorId: z.string().min(1) }).parse(req.body);
    try { return { data: await assignAppealEvaluator(id, evaluatorId, req.principal!.id) }; }
    catch (err) { return handle(reply, err); }
  });

  // Étapes 3-5 — notation à l'aveugle (second ou troisième évaluateur désigné).
  app.post("/enrollments/:id/appeal/grade", { preHandler: [authenticate, authorize("evaluation:grade")] }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = scoresBody.parse(req.body);
    try { return { data: await gradeAppeal(id, req.principal!.id, body) }; }
    catch (err) { return handle(reply, err); }
  });

  // Registre des recours (§10) — date, candidat, critères, écart, décision.
  app.get("/appeals", { preHandler: [authenticate, authorize("evaluation:assign")] }, async (req, reply) => {
    try { return { data: await listAppeals() }; } catch (err) { return handle(reply, err); }
  });

  // §9.3 — double notation : assignation (ligne auto 1/10 ou ajout manuel).
  app.post("/qc/double-marking", { preHandler: [authenticate, authorize("evaluation:assign")] }, async (req, reply) => {
    const body = z.object({ enrollmentId: z.string().min(1), evaluatorId: z.string().min(1) }).parse(req.body);
    try { return reply.status(201).send({ data: await assignDoubleMarking(body.enrollmentId, body.evaluatorId, req.principal!.id) }); }
    catch (err) { return handle(reply, err); }
  });

  // §9.3 — notation aveugle du second (n'altère jamais la note officielle).
  app.post("/qc/double-marking/:id/grade", { preHandler: [authenticate, authorize("evaluation:grade")] }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = scoresBody.parse(req.body);
    try { return { data: await gradeDoubleMarking(id, req.principal!.id, body) }; }
    catch (err) { return handle(reply, err); }
  });

  // §9.3 — un incident (> 15 pts) est tranché par un troisième évaluateur.
  app.post("/qc/double-marking/:id/resolve", { preHandler: [authenticate, authorize("user:manage")] }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({
      thirdEvaluatorId: z.string().min(1), thirdTotal: z.number().int().min(0).max(100), notes: z.string().min(1),
    }).parse(req.body);
    try { return { data: await resolveDoubleMarking(id, req.principal!.id, body) }; }
    catch (err) { return handle(reply, err); }
  });

  // §9.3 — registre + synthèse trimestrielle (médiane, alertes, incidents).
  app.get("/qc/double-marking", { preHandler: [authenticate, authorize("evaluation:assign")] }, async (req, reply) => {
    try { return { data: await listDoubleMarkings() }; } catch (err) { return handle(reply, err); }
  });
}
