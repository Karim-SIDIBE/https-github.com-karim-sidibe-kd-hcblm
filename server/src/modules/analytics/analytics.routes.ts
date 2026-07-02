import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  AnalyticsError, atRiskLearners, cohortReport, courseCompetencies, courseLearners, courseReport, courseWorkbook, learnerDiagnostic, overview, pamExport, toCsv, transcript,
} from "./analytics.service.js";
import { buildXlsx } from "../../lib/export/xlsx.js";
import { authenticate, guard, requireEnrollmentAccess } from "../../lib/auth.js";
import { scopeParam } from "../../lib/security/tenant-scope.js";

const owned = [authenticate, requireEnrollmentAccess];
// analytics:read + confine non-staff customer roles to their own org's data.
const courseScoped = [...guard("analytics:read"), scopeParam("course", "courseId")];

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

const rangeQuery = z.object({ since: z.string().datetime().optional(), until: z.string().datetime().optional() });
const toRange = (q: { since?: string; until?: string }) =>
  ({ since: q.since ? new Date(q.since) : undefined, until: q.until ? new Date(q.until) : undefined });

export async function analyticsRoutes(app: FastifyInstance) {
  // Learner transcript — owner or staff.
  app.get("/enrollments/:id/transcript", { preHandler: owned }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await transcript(id) }; } catch (err) { return handle(reply, err); }
  });

  // Platform overview (optional ?since/&until date range).
  app.get("/analytics/overview", { preHandler: guard("analytics:read") }, async (req) => {
    const q = rangeQuery.parse(req.query ?? {});
    return { data: await overview(toRange(q)) };
  });

  // Course aggregates + funnel + Block 4 completion forecast (optional date range).
  app.get("/analytics/courses/:courseId", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    const q = rangeQuery.parse(req.query ?? {});
    try { return { data: await courseReport(courseId, toRange(q)) }; } catch (err) { return handle(reply, err); }
  });

  // Per-learner course rows (JSON or CSV export).
  app.get("/analytics/courses/:courseId/learners", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    const { format } = z.object({ format: z.enum(["csv", "json"]).optional() }).parse(req.query);
    try { return maybeCsv(reply, format, await courseLearners(courseId), `course-${courseId}-learners`); }
    catch (err) { return handle(reply, err); }
  });

  // Full course report as a multi-sheet Excel workbook (over the full dataset).
  app.get("/analytics/courses/:courseId/export.xlsx", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    try {
      const buf = buildXlsx(await courseWorkbook(courseId));
      return reply
        .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("content-disposition", `attachment; filename="rapport-${courseId}.xlsx"`)
        .send(buf);
    } catch (err) { return handle(reply, err); }
  });

  // Dropout-risk ranking for a course's learners (predictive analytics).
  app.get("/analytics/courses/:courseId/at-risk", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    try { return { data: await atRiskLearners(courseId) }; } catch (err) { return handle(reply, err); }
  });

  // Cohort competency map: average diagnostic score per sub-area (weakest first).
  app.get("/analytics/courses/:courseId/competencies", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    try { return { data: await courseCompetencies(courseId) }; } catch (err) { return handle(reply, err); }
  });

  // One learner's diagnostic competency profile (admin view).
  app.get("/analytics/enrollments/:id/diagnostic", { preHandler: [...guard("analytics:read"), scopeParam("enrollment", "id")] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return { data: await learnerDiagnostic(id) };
  });

  // Raw PAM export for a course (JSON or CSV) — authorised review (§6.1).
  app.get("/analytics/courses/:courseId/pam", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    const { format, ...range } = z.object({ format: z.enum(["csv", "json"]).optional() }).merge(rangeQuery).parse(req.query ?? {});
    try { return maybeCsv(reply, format, await pamExport(courseId, toRange(range)) as unknown as Record<string, unknown>[], `course-${courseId}-pam`); }
    catch (err) { return handle(reply, err); }
  });

  // Cohort report (JSON or CSV).
  app.get("/analytics/cohorts/:cohortId", { preHandler: [...guard("analytics:read"), scopeParam("cohort", "cohortId")] }, async (req, reply) => {
    const { cohortId } = z.object({ cohortId: z.string() }).parse(req.params);
    const { format } = z.object({ format: z.enum(["csv", "json"]).optional() }).parse(req.query);
    try {
      const report = await cohortReport(cohortId);
      if (format === "csv") return maybeCsv(reply, "csv", report.rows as unknown as Record<string, unknown>[], `cohort-${cohortId}`);
      return { data: report };
    } catch (err) { return handle(reply, err); }
  });
}
