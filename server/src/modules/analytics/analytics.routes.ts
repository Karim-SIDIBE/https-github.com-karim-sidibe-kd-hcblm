import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  AnalyticsError, atRiskLearners, cohortReport, compareInsights, courseCompetencies, courseInsights, courseLearners, courseReport, courseWorkbook, exploreStatements, khcblmTargets, learnerDiagnostic, overview, pamExport, toCsv, transcript,
} from "./analytics.service.js";
import { buildXlsx } from "../../lib/export/xlsx.js";
import { authenticate, guard, requireEnrollmentAccess } from "../../lib/auth.js";
import { scopeParam } from "../../lib/security/tenant-scope.js";
import { envelope, pageQuery, sortSpec } from "../../lib/paging.js";
import { prisma } from "../../db/prisma.js";

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

  // Cibles K-HCBLM v2.2 (ch. 7) — mesures vs cibles officielles du modèle.
  app.get("/analytics/khcblm-targets", { preHandler: guard("analytics:read") }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string().optional() }).parse(req.query ?? {});
    try { return { data: await khcblmTargets(courseId) }; } catch (err) { return handle(reply, err); }
  });

  // Course aggregates + funnel + Block 4 completion forecast (optional date range).
  app.get("/analytics/courses/:courseId", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    const q = rangeQuery.parse(req.query ?? {});
    try { return { data: await courseReport(courseId, toRange(q)) }; } catch (err) { return handle(reply, err); }
  });

  // Re-engagement history of a course (M4): every J+3/7/14 message sent, with
  // the learner it went to — the Relances screen's audit trail.
  app.get("/analytics/courses/:courseId/relances", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    const query = pageQuery.parse(req.query ?? {});
    try {
      const where = { enrollment: { courseId } };
      const [total, rows] = await Promise.all([
        prisma.reEngagementMessage.count({ where }),
        prisma.reEngagementMessage.findMany({
          where, orderBy: { sentAt: "desc" },
          skip: (query.page - 1) * query.pageSize, take: query.pageSize,
          include: { enrollment: { select: { id: true, user: { select: { id: true, name: true, email: true } } } } },
        }),
      ]);
      const data = rows.map((r) => ({
        id: r.id, stage: r.stage, channel: r.channel, sentAt: r.sentAt, body: r.body,
        enrollmentId: r.enrollmentId, learner: r.enrollment.user,
      }));
      return envelope(data, total, query.page, query.pageSize);
    } catch (err) { return handle(reply, err); }
  });

  // Per-learner course rows (JSON or CSV export).
  // Progress is computed in JS, so paging/sort happen here after the mapping;
  // CSV export always covers the FULL (searched) dataset, never one page.
  app.get("/analytics/courses/:courseId/learners", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    const query = pageQuery.extend({
      format: z.enum(["csv", "json"]).optional(),
      status: z.enum(["certified", "active", "inactive"]).optional(),
    }).parse(req.query ?? {});
    try {
      let rows = await courseLearners(courseId);
      const term = query.q?.trim().toLowerCase();
      if (term) rows = rows.filter((r) => (r.name + " " + r.email).toLowerCase().includes(term));
      if (query.status === "certified") rows = rows.filter((r) => r.status === "CERTIFIED");
      else if (query.status === "active") rows = rows.filter((r) => r.active && r.status !== "CERTIFIED");
      else if (query.status === "inactive") rows = rows.filter((r) => !r.active && r.status !== "CERTIFIED");
      if (query.format === "csv") return maybeCsv(reply, "csv", rows, `course-${courseId}-learners`);
      const sort = sortSpec(query.sort, ["name", "progressPercent", "lastActivity", "startedAt"], { field: "startedAt", dir: "desc" });
      const dirMul = sort.dir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const va = a[sort.field as "name"] ?? "", vb = b[sort.field as "name"] ?? "";
        return (va < vb ? -1 : va > vb ? 1 : 0) * dirMul;
      });
      const paged = "page" in ((req.query ?? {}) as object) || "pageSize" in ((req.query ?? {}) as object);
      if (!paged) return { data: rows };
      const start = (query.page - 1) * query.pageSize;
      return envelope(rows.slice(start, start + query.pageSize), rows.length, query.page, query.pageSize);
    } catch (err) { return handle(reply, err); }
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

  // Pedagogical insights from the local xAPI mini-LRS: question difficulty,
  // time-on-task per item, video completion, and the course funnel.
  app.get("/analytics/courses/:courseId/insights", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    try { return { data: await courseInsights(courseId) }; } catch (err) { return handle(reply, err); }
  });

  // Trace explorer — free-form one-dimension aggregation over the course's
  // xAPI statements (grouping × filters × metrics), "Series API" style.
  app.get("/analytics/courses/:courseId/explore", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    const q = z.object({
      groupBy: z.enum(["verb", "activity", "item", "block", "learner", "day"]).default("verb"),
      verb: z.string().optional(),
      blockIndex: z.coerce.number().int().min(0).optional(),
      itemKey: z.string().optional(),
      since: z.string().datetime().optional(),
      until: z.string().datetime().optional(),
    }).parse(req.query ?? {});
    try {
      return {
        data: await exploreStatements(courseId, q.groupBy, {
          verb: q.verb, blockIndex: q.blockIndex, itemKey: q.itemKey,
          since: q.since ? new Date(q.since) : undefined,
          until: q.until ? new Date(q.until) : undefined,
        }),
      };
    } catch (err) { return handle(reply, err); }
  });

  // Segment comparison — two inscription windows, or two cohorts, side by side.
  app.get("/analytics/courses/:courseId/insights/compare", { preHandler: courseScoped }, async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    const seg = z.union([
      z.object({ mode: z.literal("period"), sinceA: z.string().datetime(), untilA: z.string().datetime(), sinceB: z.string().datetime(), untilB: z.string().datetime() }),
      z.object({ mode: z.literal("cohort"), cohortA: z.string(), cohortB: z.string() }),
    ]).parse(req.query ?? {});
    const [a, b] = seg.mode === "period"
      ? [
          { kind: "period" as const, since: new Date(seg.sinceA), until: new Date(seg.untilA) },
          { kind: "period" as const, since: new Date(seg.sinceB), until: new Date(seg.untilB) },
        ]
      : [{ kind: "cohort" as const, cohortId: seg.cohortA }, { kind: "cohort" as const, cohortId: seg.cohortB }];
    try { return { data: await compareInsights(courseId, a, b) }; } catch (err) { return handle(reply, err); }
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
