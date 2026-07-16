/**
 * sync-exercise-feedback.ts — push the fixture's (rewritten) micro-exercise
 * feedbackText into the PUBLISHED CourseVersion content, without touching
 * anything else (video links, quizzes, learner-specific patches stay intact).
 *
 * Idempotent: re-running converges to the fixture texts. The updated content is
 * re-validated against the shared Zod contract BEFORE being written.
 *
 * Usage (prod):  docker compose ... exec api npx tsx scripts/sync-exercise-feedback.ts
 * Usage (dev):   npx tsx scripts/sync-exercise-feedback.ts [courseId]
 */
import { prisma } from "../src/db/prisma.js";
import { CourseContent } from "../src/domain/content-model.js";
import { n1Full } from "../src/domain/fixtures/n1-full.js";

async function resolveCourseId(): Promise<string> {
  const arg = process.argv[2];
  if (arg) return arg;
  const bySlug = await prisma.course.findUnique({ where: { slug: "gestion-du-temps-n1" } });
  if (bySlug) return bySlug.id;
  const anyPublished = await prisma.courseVersion.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "asc" } });
  if (!anyPublished) throw new Error("Aucun parcours publié — passez un courseId en argument.");
  return anyPublished.courseId;
}

const courseId = await resolveCourseId();
const version = await prisma.courseVersion.findFirst({ where: { courseId, status: "PUBLISHED" } });
if (!version) throw new Error(`Aucune version publiée pour le parcours ${courseId}.`);

// fixture (block index, micro-session id) → feedbackText
const fixtureFeedback = new Map<string, string>();
for (const b of n1Full.blocks) {
  const p = b.payload as { microSessions?: { id: string; exercise?: { feedbackText?: string } }[] };
  for (const ms of p.microSessions ?? []) {
    if (ms.exercise?.feedbackText) fixtureFeedback.set(`${b.index}:${ms.id}`, ms.exercise.feedbackText);
  }
}

const content = version.content as { blocks?: { index: number; payload?: { microSessions?: { id: string; exercise?: { feedbackText?: string } }[] } }[] };
let updated = 0, unchanged = 0, missing = 0;
for (const b of content.blocks ?? []) {
  for (const ms of b.payload?.microSessions ?? []) {
    const next = fixtureFeedback.get(`${b.index}:${ms.id}`);
    if (!next) { missing++; continue; }
    if (!ms.exercise) { missing++; continue; }
    if (ms.exercise.feedbackText === next) { unchanged++; continue; }
    ms.exercise.feedbackText = next;
    updated++;
  }
}

CourseContent.parse(content); // never write an invalid course
await prisma.courseVersion.update({ where: { id: version.id }, data: { content: content as object, updatedAt: new Date() } });
console.log(`Feedbacks micro-exercices → contenu publié (${courseId}) : ${updated} mis à jour, ${unchanged} déjà à jour, ${missing} sans correspondance.`);
await prisma.$disconnect();
