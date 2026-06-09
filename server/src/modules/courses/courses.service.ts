/**
 * courses.service.ts — authoring-side course operations.
 *
 * A Course is a stable identity; its content lives in CourseVersions. Creating a
 * course or saving a draft validates the SHAPE (a malformed document is always
 * rejected) but tolerates POLICY violations — those only block PUBLISH.
 */
import { CourseStatus, type CourseLevel, type Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { validateShape, validatePolicy } from "../../domain/validation.js";
import type { CourseContent } from "../../domain/content-model.js";
import { randomBytes } from "node:crypto";
import { indexCourseVersion } from "../search/search.service.js";
import { draftCourseContent, draftCourseFromDoc, type CourseBrief } from "../../lib/ai/authoring.js";
import { docxToParagraphs } from "../../lib/docx.js";

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

/** (Re)build the semantic-search index for a version; never fails the publish. */
async function reindex(versionId: string) {
  try { await indexCourseVersion(versionId); }
  catch (e) { console.error(`[search] indexation échouée pour ${versionId}:`, e instanceof Error ? e.message : e); }
}

const LEVEL_TO_ENUM: Record<1 | 2 | 3, CourseLevel> = {
  1: "L1",
  2: "L2",
  3: "L3",
};

export class ContentInvalidError extends Error {
  constructor(public issues: ReturnType<typeof validateShape> extends infer R ? (R extends { ok: false; issues: infer I } ? I : never) : never) {
    super("Le document de contenu est invalide");
    this.name = "ContentInvalidError";
  }
}

export class NotPublishableError extends Error {
  constructor(public issues: ReturnType<typeof validatePolicy>["issues"]) {
    super("Le parcours ne satisfait pas les règles de publication");
    this.name = "NotPublishableError";
  }
}

/** Denormalized headline fields kept in sync with the content document. */
function headline(content: CourseContent) {
  return {
    title: content.title,
    level: LEVEL_TO_ENUM[content.level],
    language: content.language,
    domainCode: content.domain.code,
    domainLabel: content.domain.label,
    passThreshold: content.passThreshold,
  };
}

/** List courses visible to the caller: the shared catalogue (no org) + courses
 *  of the orgs they belong to ("all" for cross-tenant SUPER_ADMIN). */
export async function listCourses(visibleOrgIds: string[] | "all") {
  const where = visibleOrgIds === "all"
    ? {}
    : { OR: [{ organizationId: null }, { organizationId: { in: visibleOrgIds } }] };
  return prisma.course.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
      versions: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, status: true, title: true, level: true, publishedAt: true, updatedAt: true },
      },
    },
  });
}

/**
 * Learner-facing catalogue: published courses the learner can self-enrol into
 * (platform courses + their member-org courses), with their enrolment status.
 */
export async function listCatalog(userId: string, memberOrgIds: string[]) {
  const courses = await prisma.course.findMany({
    where: { OR: [{ organizationId: null }, { organizationId: { in: memberOrgIds } }], versions: { some: { status: "PUBLISHED" } } },
    orderBy: { updatedAt: "desc" },
    include: { versions: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1, select: { title: true, level: true } } },
  });
  const enrolled = new Set((await prisma.enrollment.findMany({ where: { userId }, select: { courseId: true } })).map((e) => e.courseId));
  return courses
    .filter((c) => c.versions.length > 0)
    .map((c) => ({ courseId: c.id, slug: c.slug, title: c.versions[0]!.title, level: c.versions[0]!.level as string, enrolled: enrolled.has(c.id) }));
}

export async function getCourse(id: string) {
  return prisma.course.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true } },
      versions: { orderBy: { version: "desc" } },
    },
  });
}

/** Create a course + its first DRAFT version from a content document. */
export async function createCourse(params: { slug: string; content: unknown; authorId?: string; organizationId?: string | null }) {
  const shape = validateShape(params.content);
  if (!shape.ok) throw new ContentInvalidError(shape.issues as never);

  const data = headline(shape.content);
  return prisma.course.create({
    data: {
      slug: params.slug,
      authorId: params.authorId ?? null,
      organizationId: params.organizationId ?? null,
      versions: {
        create: {
          version: 1,
          status: CourseStatus.DRAFT,
          ...data,
          content: shape.content as unknown as Prisma.InputJsonValue,
        },
      },
    },
    include: { versions: true },
  });
}

/** AI-assisted draft: generate a validated DRAFT course from a brief. */
export async function draftCourse(brief: CourseBrief, authorId?: string, organizationId?: string | null) {
  const { content, aiGenerated, provider } = await draftCourseContent(brief);
  const shape = validateShape(content);
  if (!shape.ok) throw new ContentInvalidError(shape.issues as never); // scaffold should never fail

  const slug = `${slugify(`${brief.domainLabel}-n${brief.level}`)}-${randomBytes(2).toString("hex")}`;
  const course = await prisma.course.create({
    data: {
      slug, authorId: authorId ?? null, organizationId: organizationId ?? null,
      versions: {
        create: { version: 1, status: CourseStatus.DRAFT, ...headline(shape.content), content: shape.content as unknown as Prisma.InputJsonValue },
      },
    },
    include: { versions: true },
  });
  return { course, draft: { aiGenerated, provider }, policy: validatePolicy(shape.content) };
}

/**
 * Import a Word (.docx) document into a DRAFT course content (NOT persisted).
 * Returns the pre-filled content + per-block raw-text notes for the editor; the
 * designer reviews, links videos, then saves through the normal create flow.
 */
export async function importCourseFromDoc(buf: Buffer) {
  const paras = docxToParagraphs(buf);
  if (paras.length === 0) throw new ContentInvalidError([{ level: "error", rule: "import", path: "document", message: "Document vide ou illisible." }] as never);
  const { content, blockNotes, aiGenerated, provider } = await draftCourseFromDoc(paras);
  const shape = validateShape(content);
  if (!shape.ok) throw new ContentInvalidError(shape.issues as never); // scaffold should never fail
  return { content: shape.content, blockNotes, aiGenerated, provider, paragraphs: paras.length };
}

/** Save edits to an existing DRAFT version (shape-validated). */
export async function updateDraftVersion(versionId: string, content: unknown) {
  const shape = validateShape(content);
  if (!shape.ok) throw new ContentInvalidError(shape.issues as never);

  const existing = await prisma.courseVersion.findUnique({ where: { id: versionId } });
  if (!existing) return null;
  if (existing.status !== CourseStatus.DRAFT) {
    throw new Error("Seules les versions en brouillon peuvent être modifiées");
  }

  return prisma.courseVersion.update({
    where: { id: versionId },
    data: {
      ...headline(shape.content),
      content: shape.content as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Run the full publish gate (shape + policy) WITHOUT mutating anything. */
export function validateContent(content: unknown) {
  const shape = validateShape(content);
  if (!shape.ok) return { shape: { ok: false as const, issues: shape.issues } };
  const policy = validatePolicy(shape.content);
  return { shape: { ok: true as const }, policy };
}

export class WorkflowError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}

/** Create the next DRAFT version of an existing course (a revision). */
export async function createNextVersion(courseId: string, content: unknown) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return null;
  const shape = validateShape(content);
  if (!shape.ok) throw new ContentInvalidError(shape.issues as never);

  const last = await prisma.courseVersion.findFirst({
    where: { courseId }, orderBy: { version: "desc" }, select: { version: true },
  });
  return prisma.courseVersion.create({
    data: {
      courseId,
      version: (last?.version ?? 0) + 1,
      status: CourseStatus.DRAFT,
      ...headline(shape.content),
      content: shape.content as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Submit a DRAFT for review (DRAFT → IN_REVIEW). Shape must already be valid. */
export async function submitForReview(versionId: string) {
  const version = await prisma.courseVersion.findUnique({ where: { id: versionId } });
  if (!version) return null;
  if (version.status !== CourseStatus.DRAFT) {
    throw new WorkflowError(409, "bad_state", "Seul un brouillon peut être soumis à la relecture");
  }
  const shape = validateShape(version.content);
  if (!shape.ok) throw new ContentInvalidError(shape.issues as never);

  return prisma.courseVersion.update({
    where: { id: versionId },
    data: { status: CourseStatus.IN_REVIEW, submittedAt: new Date(), reviewNotes: null },
  });
}

/** Reviewer decision on an IN_REVIEW version. */
export async function reviewVersion(
  versionId: string, decision: "approve" | "request_changes", reviewerId: string, notes?: string,
) {
  const version = await prisma.courseVersion.findUnique({ where: { id: versionId } });
  if (!version) return null;
  if (version.status !== CourseStatus.IN_REVIEW) {
    throw new WorkflowError(409, "bad_state", "Seule une version en relecture peut être évaluée");
  }

  if (decision === "request_changes") {
    return prisma.courseVersion.update({
      where: { id: versionId },
      data: { status: CourseStatus.DRAFT, reviewedById: reviewerId, reviewedAt: new Date(), reviewNotes: notes ?? null },
    });
  }

  // approve → publish (runs the non-negotiable gate)
  const shape = validateShape(version.content);
  if (!shape.ok) throw new ContentInvalidError(shape.issues as never);
  const policy = validatePolicy(shape.content);
  if (!policy.publishable) throw new NotPublishableError(policy.issues);
  await supersedePublished(version.courseId, versionId);
  const published = await prisma.courseVersion.update({
    where: { id: versionId },
    data: { status: CourseStatus.PUBLISHED, publishedAt: new Date(), reviewedById: reviewerId, reviewedAt: new Date(), reviewNotes: notes ?? null },
  });
  await reindex(versionId);
  return published;
}

/** Archive any other PUBLISHED version of the same course. */
async function supersedePublished(courseId: string, exceptVersionId: string) {
  await prisma.courseVersion.updateMany({
    where: { courseId, status: CourseStatus.PUBLISHED, id: { not: exceptVersionId } },
    data: { status: CourseStatus.ARCHIVED },
  });
}

/** Direct publish (admin path) — DRAFT or IN_REVIEW → PUBLISHED, gate enforced. */
export async function publishVersion(versionId: string) {
  const version = await prisma.courseVersion.findUnique({ where: { id: versionId } });
  if (!version) return null;
  if (version.status === CourseStatus.ARCHIVED) {
    throw new WorkflowError(409, "bad_state", "Une version archivée ne peut pas être publiée");
  }

  const shape = validateShape(version.content);
  if (!shape.ok) throw new ContentInvalidError(shape.issues as never);
  const policy = validatePolicy(shape.content);
  if (!policy.publishable) throw new NotPublishableError(policy.issues);

  await supersedePublished(version.courseId, versionId);
  const published = await prisma.courseVersion.update({
    where: { id: versionId },
    data: { status: CourseStatus.PUBLISHED, publishedAt: new Date() },
  });
  await reindex(versionId);
  return published;
}

/** Archive a version. */
export async function archiveVersion(versionId: string) {
  const version = await prisma.courseVersion.findUnique({ where: { id: versionId } });
  if (!version) return null;
  return prisma.courseVersion.update({ where: { id: versionId }, data: { status: CourseStatus.ARCHIVED } });
}
