import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  FeedbackError, aiCalibrationStatus, listAssessments, requestFormativeFeedback,
  requestRubricSuggestion, runAiCalibration,
} from "./feedback.service.js";
import { authenticate, authorize, requireEnrollmentAccess } from "../../lib/auth.js";
import { hasPermission } from "../../domain/auth/permissions.js";
import { audit } from "../../lib/audit.js";

const idParam = z.object({ id: z.string() });
const owned = [authenticate, requireEnrollmentAccess];

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof FeedbackError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function feedbackRoutes(app: FastifyInstance) {
  // Learner (or staff): formative feedback on one of their open submissions.
  app.post("/enrollments/:id/feedback", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { blockIndex, itemKey } = z.object({
      blockIndex: z.number().int().min(0), itemKey: z.string().min(1),
    }).parse(req.body);
    try { return { data: await requestFormativeFeedback(id, blockIndex, itemKey) }; }
    catch (err) { return handle(reply, err); }
  });

  // Evaluator/admin: AI rubric score SUGGESTION for the Bloc 4 project
  // (advisory, socle §8 : assigné/admin, hors recours, calibration passée,
  // score humain enregistré d'abord, preuve vérifiée tout-ou-rien).
  app.post("/enrollments/:id/rubric-suggestion", { preHandler: [authenticate, authorize("evaluation:grade")] }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await requestRubricSuggestion(id, req.principal) }; } catch (err) { return handle(reply, err); }
  });

  // Admin: calibration de la suggestion sur les 5 dossiers de référence (§8.8).
  app.post("/ai-calibration", { preHandler: [authenticate, authorize("user:manage")] }, async (req, reply) => {
    const body = z.object({
      courseId: z.string().min(1),
      runs: z.array(z.object({
        label: z.string().min(1),
        text: z.string().min(1),
        reference: z.array(z.number().int()),
      })).min(1).max(10),
    }).parse(req.body);
    try {
      const record = await runAiCalibration(body.courseId, body.runs, req.principal!.id);
      await audit({
        actorId: req.principal!.id, action: "ai.calibration.run", targetType: "Course", targetId: body.courseId,
        meta: { passed: record.passed, provider: record.provider, gridVersion: record.gridVersion }, ip: req.ip,
      });
      return reply.status(201).send({ data: record });
    } catch (err) { return handle(reply, err); }
  });

  // Staff: statut d'activation de la suggestion pour un parcours (§8.8).
  app.get("/ai-calibration/:courseId", { preHandler: [authenticate] }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string().min(1) }).parse(req.params);
    const role = req.principal!.role;
    if (!hasPermission(role, "evaluation:grade") && !hasPermission(role, "evaluation:assign")) {
      return reply.status(403).send({ error: "forbidden", message: "Réservé au personnel d'évaluation" });
    }
    try { return { data: await aiCalibrationStatus(courseId) }; } catch (err) { return handle(reply, err); }
  });

  // List stored AI assessments (owner/staff).
  app.get("/enrollments/:id/ai-feedback", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await listAssessments(id) }; } catch (err) { return handle(reply, err); }
  });
}
