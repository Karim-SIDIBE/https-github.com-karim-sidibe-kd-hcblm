/**
 * seed-bank-variants.ts — insert the N1 AI variant questions into the bank as
 * PENDING (a human approves/rejects each one in the admin Question Bank).
 *
 * Idempotent: provenance-keyed upsert (re-running refreshes pending variants,
 * never duplicates, and NEVER touches a variant already approved by a human).
 *
 * Usage (prod):  docker compose ... exec api npx tsx scripts/seed-bank-variants.ts
 * Usage (dev):   npx tsx scripts/seed-bank-variants.ts [courseId]
 * The course is resolved from the published N1 course (slug or first published)
 * unless a courseId is passed explicitly.
 */
import { prisma } from "../src/db/prisma.js";
import { n1Variants } from "../src/domain/fixtures/n1-variants.js";

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
let created = 0, refreshed = 0, skippedApproved = 0;
for (const v of n1Variants) {
  const sourceQuestionId = `ai:${v.variantOf}#${v.question.id}`;
  const existing = await prisma.bankQuestion.findUnique({
    where: { sourceCourseId_sourceQuestionId: { sourceCourseId: courseId, sourceQuestionId } },
  });
  if (existing) {
    if (existing.status === "approved") { skippedApproved++; continue; } // human decision wins
    await prisma.bankQuestion.update({ where: { id: existing.id }, data: { question: v.question as object, subArea: v.subArea, note: v.angle } });
    refreshed++;
  } else {
    await prisma.bankQuestion.create({
      data: {
        question: v.question as object, subArea: v.subArea, level: "1",
        status: "pending", origin: "ai", note: v.angle,
        sourceCourseId: courseId, sourceQuestionId,
      },
    });
    created++;
  }
}
console.log(`Variantes N1 → banque (parcours ${courseId}) : ${created} créées, ${refreshed} rafraîchies, ${skippedApproved} déjà validées (intouchées).`);
await prisma.$disconnect();
