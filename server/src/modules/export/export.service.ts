/**
 * export.service.ts — export a published course to a portable standard package.
 */
import { prisma } from "../../db/prisma.js";
import { CourseContent } from "../../domain/content-model.js";
import { renderCourse } from "../../lib/export/render.js";
import { buildPackage, type ExportFormat } from "../../lib/export/packagers.js";

export class ExportError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

export async function exportCourse(courseId: string, format: ExportFormat) {
  const version = await prisma.courseVersion.findFirst({
    where: { courseId, status: "PUBLISHED" }, orderBy: { version: "desc" }, include: { course: true },
  });
  if (!version) throw new ExportError(404, "no_published", "Aucune version publiée à exporter");
  const content = CourseContent.parse(version.content);
  const rendered = renderCourse(content);
  return buildPackage(format, {
    slug: version.course.slug, title: version.title, summary: content.summary, threshold: content.passThreshold,
  }, rendered);
}
