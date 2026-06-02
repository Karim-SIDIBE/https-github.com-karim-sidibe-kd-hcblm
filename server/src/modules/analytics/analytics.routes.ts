import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  AnalyticsError, cohortReport, courseLearners, courseReport, overview, toCsv, transcript,
} from "./analytics.service.js";
import { authenticate, guard, requireEnrollmentAccess } from "../../lib/auth.js";

const owned = [authenticate, requireEnrollmentAccess];

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof AnalyticsError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

function maybeCsv(reply: FastifyReply, format: string | undefined, rows: Record<string, unknown>[], filename: string) {
  if (format === "csv") {
    return reply.header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="${filename}.csv"`).send(toCsv(rows));
  }
  return { data: rows };
}

export async function analyticsRoutes(app: FastifyInstance) {
  // Learner transcript — owner or staff.
  app.get("/enrollments/:id/transcript", { preHandler: owned }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await transcript(id) }; } catch (err) { return handle(reply, err); }
  });

  // Platform overview.
  app.get("/analytics/overview", { preHandler: guard("analytics:read") }, async () => ({ data: await overview() }));

  // Course aggregates + funnel.
  app.get("/analytics/courses/:courseId", { preHandler: guard("analytics:read") }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    try { return { data: await courseReport(courseId) }; } catch (err) { return handle(reply, err); }
  });

  // Per-learner course rows (JSON or CSV export).
  app.get("/analytics/courses/:courseId/learners", { preHandler: guard("analytics:read") }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    const { format } = z.object({ format: z.enum(["csv", "json"]).optional() }).parse(req.query);
    try { return maybeCsv(reply, format, await courseLearners(courseId), `course-${courseId}-learners`); }
    catch (err) { return handle(reply, err); }
  });

  // Cohort report (JSON or CSV).
  app.get("/analytics/cohorts/:cohortId", { preHandler: guard("analytics:read") }, async (req, reply) => {
    const { cohortId } = z.object({ cohortId: z.string() }).parse(req.params);
    const { format } = z.object({ format: z.enum(["csv", "json"]).optional() }).parse(req.query);
    try {
      const report = await cohortReport(cohortId);
      if (format === "csv") return maybeCsv(reply, "csv", report.rows as unknown as Record<string, unknown>[], `cohort-${cohortId}`);
      return { data: report };
    } catch (err) { return handle(reply, err); }
  });
}
