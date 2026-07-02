import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { ReportError, createSchedule, deleteSchedule, listSchedules } from "./reports.service.js";
import { guard } from "../../lib/auth.js";
import { TenantScopeError, assertCourseAccess, visibleCourseIds } from "../../lib/security/tenant-scope.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof ReportError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  if (err instanceof TenantScopeError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  throw err;
}

export async function reportsRoutes(app: FastifyInstance) {
  // Scheduled e-mail reports (admins with analytics access) — tenant-scoped so a
  // customer role can only see / manage / create schedules for its own courses.
  app.get("/reports/schedules", { preHandler: guard("analytics:read") }, async (req) => {
    const { courseId } = z.object({ courseId: z.string().optional() }).parse(req.query ?? {});
    const visible = await visibleCourseIds(req.principal!);
    return { data: await listSchedules(courseId, visible) };
  });

  app.post("/reports/schedules", { preHandler: guard("analytics:read") }, async (req, reply) => {
    const body = z.object({
      courseId: z.string(),
      recipients: z.array(z.string()).min(1),
      frequency: z.enum(["WEEKLY", "MONTHLY"]),
      format: z.enum(["xlsx", "csv"]).optional(),
    }).parse(req.body);
    try {
      // Block exfiltration: only schedule reports for a course the caller may read.
      await assertCourseAccess(req.principal!, body.courseId);
      return reply.status(201).send({ data: await createSchedule({ ...body, createdById: req.principal?.id }) });
    } catch (err) { return handle(reply, err); }
  });

  app.delete("/reports/schedules/:id", { preHandler: guard("analytics:read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      const visible = await visibleCourseIds(req.principal!);
      return { data: await deleteSchedule(id, visible) };
    } catch (err) { return handle(reply, err); }
  });
}
