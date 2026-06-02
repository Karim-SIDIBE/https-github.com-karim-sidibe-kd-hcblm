/**
 * search.service.ts — semantic search over published course content.
 *
 * On publish, a course version is chunked into meaningful units, embedded and
 * stored. Queries are embedded and ranked by cosine similarity in-process.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { CourseContent, type CourseContent as CourseContentT } from "../../domain/content-model.js";
import { embed, cosine } from "../../lib/ai/embeddings.js";

type Chunk = { blockIndex: number | null; path: string; text: string };

/** Extract searchable chunks from a course content document. */
export function chunkContent(content: CourseContentT): Chunk[] {
  const out: Chunk[] = [];
  const push = (blockIndex: number | null, path: string, text?: string | null) => {
    const t = (text ?? "").trim();
    if (t.length >= 3) out.push({ blockIndex, path, text: t });
  };

  push(null, "summary", `${content.title}. ${content.summary} ${content.audience}`);

  for (const b of content.blocks) {
    const i = b.index;
    push(i, `blocks[${i}]`, `${b.title}. ${b.objective}`);
    switch (b.type) {
      case "ONBOARDING":
        push(i, `blocks[${i}].momentAncrage`, b.payload.momentAncrage.promptText);
        push(i, `blocks[${i}].profiles`, b.payload.profileChoices.map((p) => `${p.name}: ${p.description}`).join(" "));
        push(i, `blocks[${i}].triggerVideo`, `${b.payload.triggerVideo.title}. ${b.payload.triggerVideo.keyMessage} ${b.payload.triggerVideo.africanExample}`);
        break;
      case "COMPREHENSION":
        b.payload.diagnosticQuiz.questions.forEach((q) => push(i, `blocks[${i}].diagnostic.${q.id}`, `${q.scenarioText} ${q.feedbackText}`));
        b.payload.microSessions.forEach((m) => push(i, `blocks[${i}].${m.id}`, `${m.title}. ${m.summaryPoints.join(". ")} ${m.video.keyMessage} ${m.video.africanExample} ${m.exercise.prompt}`));
        if (b.payload.caseStudy) push(i, `blocks[${i}].case`, `${b.payload.caseStudy.title}. ${b.payload.caseStudy.steps.join(" ")}`);
        break;
      case "PRACTICE":
        b.payload.microSessions.forEach((m) => push(i, `blocks[${i}].${m.id}`, `${m.title}. ${m.summaryPoints.join(". ")} ${m.video.keyMessage} ${m.video.africanExample} ${m.exercise.prompt}`));
        b.payload.guidedScenarios.forEach((s, k) => push(i, `blocks[${i}].scenario${k}`, `${s.title}. ${s.contextAfricain} ${s.steps.map((st) => st.question).join(" ")}`));
        if (b.payload.interBlockQuiz) b.payload.interBlockQuiz.questions.forEach((q) => push(i, `blocks[${i}].interblock.${q.id}`, q.scenarioText));
        push(i, `blocks[${i}].field`, b.payload.fieldApplication.brief);
        break;
      case "ANCHORING":
        b.payload.microSessions.forEach((m) => push(i, `blocks[${i}].${m.id}`, `${m.title}. ${m.summaryPoints.join(". ")} ${m.video.keyMessage} ${m.video.africanExample} ${m.exercise.prompt}`));
        push(i, `blocks[${i}].selfAssessment`, b.payload.selfAssessment.criteria.join(". "));
        b.payload.finalQuiz.questions.forEach((q) => push(i, `blocks[${i}].final.${q.id}`, `${q.scenarioText} ${q.feedbackText}`));
        break;
      case "CERTIFICATION":
        push(i, `blocks[${i}].brief`, b.payload.projectBrief);
        b.payload.journal.entries.forEach((e) => push(i, `blocks[${i}].journal.J+${e.day}`, e.prompt));
        push(i, `blocks[${i}].rubric`, b.payload.rubric.criteria.map((c) => c.label).join(". "));
        break;
    }
  }
  return out;
}

/** (Re)index a course version. Returns the number of chunks stored. */
export async function indexCourseVersion(versionId: string): Promise<{ chunks: number; model: string }> {
  const version = await prisma.courseVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error("Version introuvable");
  const content = CourseContent.parse(version.content);
  const chunks = chunkContent(content);
  const { vectors, model } = await embed(chunks.map((c) => c.text));

  await prisma.$transaction([
    prisma.searchChunk.deleteMany({ where: { courseVersionId: versionId } }),
    prisma.searchChunk.createMany({
      data: chunks.map((c, k) => ({
        courseVersionId: versionId, blockIndex: c.blockIndex, path: c.path, text: c.text,
        embedding: vectors[k] as unknown as Prisma.InputJsonValue, model,
      })),
    }),
  ]);
  return { chunks: chunks.length, model };
}

export type SearchHit = { score: number; courseSlug: string; blockIndex: number | null; path: string; text: string };

/** Semantic search across published versions (optionally scoped to a course). */
export async function search(query: string, opts: { courseId?: string; k?: number } = {}): Promise<SearchHit[]> {
  const k = opts.k ?? 5;
  const versions = await prisma.courseVersion.findMany({
    where: { status: "PUBLISHED", ...(opts.courseId ? { courseId: opts.courseId } : {}) },
    include: { course: { select: { slug: true } }, searchChunks: true },
  });

  const { vectors } = await embed([query]);
  const qv = vectors[0]!;

  const hits: SearchHit[] = [];
  for (const v of versions) {
    for (const ch of v.searchChunks) {
      hits.push({
        score: cosine(qv, ch.embedding as number[]),
        courseSlug: v.course.slug, blockIndex: ch.blockIndex, path: ch.path, text: ch.text,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}
