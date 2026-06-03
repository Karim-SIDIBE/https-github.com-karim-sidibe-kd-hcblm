import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  FeedbackError, listAssessments, requestFormativeFeedback, requestRubricSuggestion,
} from "./feedback.service.js";
import { authenticate, authorize, requireEnrollmentAccess } from "../../lib/auth.js";

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

  // Evaluator/admin: AI rubric score SUGGESTION for the Bloc 4 project (advisory).
  app.post("/enrollments/:id/rubric-suggestion", { preHandler: [authenticate, authorize("evaluation:grade")] }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await requestRubricSuggestion(id) }; } catch (err) { return handle(reply, err); }
  });

  // List stored AI assessments (owner/staff).
  app.get("/enrollments/:id/ai-feedback", { preHandler: owned }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    try { return { data: await listAssessments(id) }; } catch (err) { return handle(reply, err); }
  });
}
