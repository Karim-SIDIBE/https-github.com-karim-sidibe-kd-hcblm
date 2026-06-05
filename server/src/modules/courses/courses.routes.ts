import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  ContentInvalidError,
  NotPublishableError,
  WorkflowError,
  archiveVersion,
  createCourse,
  createNextVersion,
  draftCourse,
  getCourse,
  listCatalog,
  listCourses,
  publishVersion,
  reviewVersion,
  submitForReview,
  updateDraftVersion,
  validateContent,
} from "./courses.service.js";
import { guard, authenticate } from "../../lib/auth.js";
import { resolveTenant, memberOrgIds } from "../../lib/tenant.js";
import { audit } from "../../lib/audit.js";

const SlugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug invalide (minuscules, chiffres et tirets)");

const CreateBody = z.object({
  slug: SlugSchema,
  authorId: z.string().optional(),
  content: z.unknown(),
});

const versionParam = z.object({ versionId: z.string() });

/** Map domain errors to HTTP responses. */
function mapErr(reply: FastifyReply, err: unknown) {
  if (err instanceof ContentInvalidError) return reply.status(422).send({ error: "content_invalid", issues: err.issues });
  if (err instanceof NotPublishableError) return reply.status(409).send({ error: "not_publishable", issues: err.issues });
  if (err instanceof WorkflowError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  if (err instanceof Error && err.message.includes("Unique constraint")) return reply.conflict("Un parcours avec ce slug existe déjà");
  throw err;
}

export async function courseRoutes(app: FastifyInstance) {
  // Learner catalogue: published courses the caller can self-enrol into.
  app.get("/catalog", { preHandler: authenticate }, async (req) => {
    const p = req.principal!;
    const orgs = p.role === "SUPER_ADMIN" ? [] : await memberOrgIds(p);
    return { data: await listCatalog(p.id, orgs) };
  });

  // --- reads (any authenticated user with course:read), tenant-scoped ---
  app.get("/courses", { preHandler: guard("course:read") }, async (req) => {
    const p = req.principal!;
    const visible = p.role === "SUPER_ADMIN" ? "all" as const : await memberOrgIds(p);
    return { data: await listCourses(visible) };
  });

  app.get("/courses/:id", { preHandler: guard("course:read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const course = await getCourse(id);
    if (!course) return reply.notFound("Parcours introuvable");
    // Tenant isolation: an org-scoped course is only visible to its members.
    const p = req.principal!;
    if (course.organizationId && p.role !== "SUPER_ADMIN") {
      const member = (await memberOrgIds(p)).includes(course.organizationId);
      if (!member) return reply.notFound("Parcours introuvable");
    }
    return { data: course };
  });

  // --- authoring (Learning Designer) ---
  app.post("/courses", { preHandler: guard("course:create") }, async (req, reply) => {
    const body = CreateBody.parse(req.body);
    const ctx = await resolveTenant(req.principal!, req.headers["x-org-id"]);
    try {
      const course = await createCourse({ slug: body.slug, authorId: body.authorId ?? req.principal?.id, content: body.content, organizationId: ctx?.organizationId });
      return reply.status(201).send({ data: course });
    } catch (err) { return mapErr(reply, err); }
  });

  // AI-assisted draft from a brief → validated DRAFT course.
  app.post("/courses/draft", { preHandler: guard("course:create") }, async (req, reply) => {
    const brief = z.object({
      domainCode: z.string().trim().min(1),
      domainLabel: z.string().trim().min(1),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      title: z.string().optional(),
      audience: z.string().optional(),
      competencies: z.array(z.object({ code: z.string(), label: z.string() })).optional(),
    }).parse(req.body);
    const ctx = await resolveTenant(req.principal!, req.headers["x-org-id"]);
    try {
      const result = await draftCourse(brief, req.principal?.id, ctx?.organizationId);
      return reply.status(201).send({ data: result });
    } catch (err) { return mapErr(reply, err); }
  });

  app.post("/courses/:id/versions", { preHandler: guard("course:create") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { content } = z.object({ content: z.unknown() }).parse(req.body);
    try {
      const version = await createNextVersion(id, content);
      if (!version) return reply.notFound("Parcours introuvable");
      return reply.status(201).send({ data: version });
    } catch (err) { return mapErr(reply, err); }
  });

  app.post("/courses/validate", { preHandler: guard("course:read") }, async (req) => {
    const { content } = z.object({ content: z.unknown() }).parse(req.body);
    return validateContent(content);
  });

  app.put("/versions/:versionId", { preHandler: guard("course:update") }, async (req, reply) => {
    const { versionId } = versionParam.parse(req.params);
    const { content } = z.object({ content: z.unknown() }).parse(req.body);
    try {
      const updated = await updateDraftVersion(versionId, content);
      if (!updated) return reply.notFound("Version introuvable");
      return { data: updated };
    } catch (err) { return mapErr(reply, err); }
  });

  // --- review workflow ---
  app.post("/versions/:versionId/submit-review", { preHandler: guard("course:submit_review") }, async (req, reply) => {
    const { versionId } = versionParam.parse(req.params);
    try {
      const v = await submitForReview(versionId);
      if (!v) return reply.notFound("Version introuvable");
      return { data: v };
    } catch (err) { return mapErr(reply, err); }
  });

  app.post("/versions/:versionId/review", { preHandler: guard("course:review") }, async (req, reply) => {
    const { versionId } = versionParam.parse(req.params);
    const { decision, notes } = z.object({
      decision: z.enum(["approve", "request_changes"]),
      notes: z.string().optional(),
    }).parse(req.body);
    try {
      const v = await reviewVersion(versionId, decision, req.principal!.id, notes);
      if (!v) return reply.notFound("Version introuvable");
      await audit({ actorId: req.principal!.id, action: `course.review.${decision}`, targetType: "CourseVersion", targetId: versionId, ip: req.ip, meta: { status: v.status } });
      return { data: v };
    } catch (err) { return mapErr(reply, err); }
  });

  // --- publish / archive (admin path) ---
  app.post("/versions/:versionId/publish", { preHandler: guard("course:publish") }, async (req, reply) => {
    const { versionId } = versionParam.parse(req.params);
    try {
      const published = await publishVersion(versionId);
      if (!published) return reply.notFound("Version introuvable");
      await audit({ actorId: req.principal!.id, action: "course.publish", targetType: "CourseVersion", targetId: versionId, ip: req.ip });
      return { data: published };
    } catch (err) { return mapErr(reply, err); }
  });

  app.post("/versions/:versionId/archive", { preHandler: guard("course:archive") }, async (req, reply) => {
    const { versionId } = versionParam.parse(req.params);
    try {
      const v = await archiveVersion(versionId);
      if (!v) return reply.notFound("Version introuvable");
      return { data: v };
    } catch (err) { return mapErr(reply, err); }
  });
}
