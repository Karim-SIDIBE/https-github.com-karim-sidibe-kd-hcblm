import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  EngineError, captureMomentAncrage, completeItem, designatePeer, enroll, getEnrollment,
  getResume, listXapi, recordRubricEvaluation, renderBlock, savePosition,
  submitDiagnosticQuiz, submitFinalQuiz, submitInterBlockQuiz, submitTriggerQuiz,
} from "./enrollments.service.js";
import { listForEnrollment } from "../notifications/notifications.service.js";
import { authenticate, authorize, guard, requireEnrollmentAccess } from "../../lib/auth.js";
import { isStaff } from "../../domain/auth/permissions.js";
import { audit } from "../../lib/audit.js";

/** Owner-or-staff guard for learner-scoped routes. */
const owned = [authenticate, requireEnrollmentAccess];

/** Item types that flow through the generic completion endpoint. */
const GenericItemType = z.enum([
  "MICRO_SESSION", "CASE_STUDY", "GUIDED_SCENARIOS", "FIELD_APPLICATION",
  "SELF_ASSESSMENT", "ACTION_PLAN", "PROJECT", "JOURNAL_ENTRY",
]);

const idParam = z.object({ id: z.string() });
const answers = z.record(z.string(), z.string());

function handle(reply: import("fastify").FastifyReply, err: unknown) {
  if (err instanceof EngineError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function enrollmentRoutes(app: FastifyInstance) {
  // Enrol — needs enrollment:create; a learner may only enrol themselves.
  app.post("/enrollments", { preHandler: guard("enrollment:create") }, async (req, reply) => {
    const { userId, courseId, isEnterprise } = z.object({
      userId: z.string(), courseId: z.string(), isEnterprise: z.boolean().optional(),
    }).parse(req.body);
    const p = req.principal!;
    if (userId !== p.id && !isStaff(p.role)) {
      return reply.status(403).send({ error: "forbidden", message: "Un apprenant ne peut inscrire que lui-même" });
    }
    try {
      const e = await enroll(userId, courseId, isEnterprise ?? false);
      return reply.status(201).send({ data: e });
    } catch (err) { return handle(reply, err); }
  });

  // Full progress map + badges — owner or staff
  app.get("/enrollments/:id", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await getEnrollment(id) }; } catch (err) { return handle(reply, err); }
  });

  // Auto-resume target (Pilier 6.2)
  app.get("/enrollments/:id/resume", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await getResume(id) }; } catch (err) { return handle(reply, err); }
  });

  // Save exact position (heartbeat)
  app.post("/enrollments/:id/position", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { blockIndex, itemKey, positionSec, durationSec } = z.object({
      blockIndex: z.number().int().min(0), itemKey: z.string().min(1),
      positionSec: z.number().int().min(0).optional(), durationSec: z.number().int().positive().optional(),
    }).parse(req.body);
    try { return { data: await savePosition(id, blockIndex, itemKey, positionSec, durationSec) }; } catch (err) { return handle(reply, err); }
  });

  // xAPI statements for this enrolment
  app.get("/enrollments/:id/xapi", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await listXapi(id) }; } catch (err) { return handle(reply, err); }
  });

  // Notifications for this enrolment
  app.get("/enrollments/:id/notifications", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await listForEnrollment(id) }; } catch (err) { return handle(reply, err); }
  });

  // Capture Moment d'Ancrage
  app.post("/enrollments/:id/moment-ancrage", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { text } = z.object({ text: z.string() }).parse(req.body);
    try { return { data: await captureMomentAncrage(id, text) }; } catch (err) { return handle(reply, err); }
  });

  // Designate progress peer
  app.post("/enrollments/:id/peer", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { name, email } = z.object({ name: z.string().trim().min(1), email: z.string().email() }).parse(req.body);
    try { return { data: await designatePeer(id, name, email) }; } catch (err) { return handle(reply, err); }
  });

  // Generic item completion
  app.post("/enrollments/:id/items", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({
      blockIndex: z.number().int().min(0),
      itemType: GenericItemType,
      itemKey: z.string().min(1),
      data: z.unknown().optional(),
    }).parse(req.body);
    try { return { data: await completeItem(id, body.blockIndex, body.itemType, body.itemKey, body.data) }; }
    catch (err) { return handle(reply, err); }
  });

  // Quizzes
  app.post("/enrollments/:id/quiz/trigger", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({ answers: answers.default({}), profileKey: z.string().optional() }).parse(req.body ?? {});
    try { return { data: await submitTriggerQuiz(id, body.answers, body.profileKey) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/enrollments/:id/quiz/interblock", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { answers: a } = z.object({ answers }).parse(req.body);
    try { return { data: await submitInterBlockQuiz(id, a) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/enrollments/:id/quiz/diagnostic", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { answers: a } = z.object({ answers }).parse(req.body);
    try { return { data: await submitDiagnosticQuiz(id, a) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/enrollments/:id/quiz/final", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { answers: a } = z.object({ answers }).parse(req.body);
    try { return { data: await submitFinalQuiz(id, a) }; } catch (err) { return handle(reply, err); }
  });

  // Human rubric evaluation — evaluator/admin only (NOT the learner).
  // Per-criterion scoring (preferred); a single scorePct is still accepted.
  app.post("/enrollments/:id/evaluation", { preHandler: [authenticate, authorize("evaluation:grade")] }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({
      criteria: z.array(z.object({ label: z.string().optional(), index: z.number().int().min(0).optional(), points: z.number().int().min(0) })).optional(),
      scorePct: z.number().int().min(0).max(100).optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    try {
      const data = await recordRubricEvaluation(id, body);
      await audit({ actorId: req.principal!.id, action: "evaluation.grade", targetType: "Enrollment", targetId: id, ip: req.ip, meta: { scorePct: (data as any).evaluation?.scorePct } });
      return { data };
    } catch (err) { return handle(reply, err); }
  });

  // Rendered (PAM-injected) block — 403 if locked
  app.get("/enrollments/:id/blocks/:index", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { index } = z.object({ index: z.coerce.number().int().min(0) }).parse(req.params);
    try { return { data: await renderBlock(id, index) }; } catch (err) { return handle(reply, err); }
  });
}
