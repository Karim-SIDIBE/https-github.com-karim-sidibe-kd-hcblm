/**
 * sync-parcours-v21.ts — align the PUBLISHED course content with the v2.1
 * screen-review lot (document « Parcours Complet — corrections écrans 1–43 ») :
 *
 *   - durées harmonisées (micro-sessions 10/15 min, quiz 15/9 min, activités
 *     longues 30/21/35/20 min) + titres « Micro-session X.Y — … » ;
 *   - étude de cas Nadia COMPLÈTE (3 étapes, QCM + réflexions ouvertes
 *     sauvegardées pour le Bloc 4, résumé des apprentissages) ;
 *   - cas transversal Sylvie (Bloc 3) + micro-session 3.2 en vidéo seule ;
 *   - Application terrain guidée en 3 étapes ; Plan d'action 30 j restructuré ;
 *   - journal du Bloc 4 recadencé J+2 → J+15 avec les questions de l'énoncé ;
 *   - lettres des bonnes réponses rééquilibrées (diagnostic C ≤ 25 %,
 *     interbloc, quiz final).
 *
 * The merge takes the NEW FIXTURE as source of truth for those payloads while
 * PRESERVING what production owns: bound videos (mediaId/url/durations), the
 * trigger video, any admin-declared itemOrder, and question pools. Idempotent;
 * the result is validated against the shared Zod contract BEFORE being written.
 *
 * Usage (prod):  docker compose ... exec api npx tsx scripts/sync-parcours-v21.ts
 * Usage (dev):   npx tsx scripts/sync-parcours-v21.ts [courseId]
 */
import { prisma } from "../src/db/prisma.js";
import { CourseContent } from "../src/domain/content-model.js";
import { validatePolicy } from "../src/domain/validation.js";
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

type AnyRec = Record<string, any>;
const current = version.content as AnyRec;
const currentBlocks: AnyRec[] = current.blocks ?? [];
const byIndex = new Map<number, AnyRec>(currentBlocks.map((b) => [b.index, b]));

// Start from the fixture (the reviewed course), then graft back everything that
// production owns so nothing operational is lost.
const next: AnyRec = JSON.parse(JSON.stringify(n1Full));
next.title = current.title ?? next.title;
next.certificate = current.certificate ?? next.certificate;

let keptVideos = 0;
for (const nb of next.blocks as AnyRec[]) {
  const cb = byIndex.get(nb.index);
  if (!cb) continue;
  // 1) admin-declared display arrangement survives — EXCEPT on Blocs 3 & 4,
  //    whose canonical order is now the prescribed découpage (groupe
  //    « Productivité hybride », sections 4.1→4.4 avec le journal en 4e) ;
  //    un ancien itemOrder y disperserait les groupes.
  if (nb.index < 3 && Array.isArray(cb.itemOrder) && cb.itemOrder.length) nb.itemOrder = cb.itemOrder;
  // 2) bound videos survive (mediaId, url, duration, subtitles…)
  if (nb.payload?.triggerVideo && cb.payload?.triggerVideo) { nb.payload.triggerVideo = cb.payload.triggerVideo; keptVideos++; }
  const curMs = new Map<string, AnyRec>((cb.payload?.microSessions ?? []).map((m: AnyRec) => [m.id, m]));
  for (const ms of nb.payload?.microSessions ?? []) {
    const cur = curMs.get(ms.id);
    if (cur?.video) { ms.video = cur.video; keptVideos++; }
  }
  // 3) question pools configured in prod survive
  for (const key of ["diagnosticQuiz", "interBlockQuiz", "finalQuiz"]) {
    if (nb.payload?.[key] && cb.payload?.[key]?.pool) nb.payload[key].pool = cb.payload[key].pool;
  }
}

const parsed = CourseContent.parse(next); // never write an invalid course
const policy = validatePolicy(parsed);
if (!policy.publishable) {
  console.error(policy.issues);
  throw new Error("Le contenu fusionné ne passe pas la barrière de publication — rien n'a été écrit.");
}

await prisma.courseVersion.update({ where: { id: version.id }, data: { content: parsed as object, updatedAt: new Date() } });
const dq = (parsed.blocks[1] as AnyRec).payload.diagnosticQuiz;
console.log(`Parcours v2.1 → contenu publié (${courseId}) :`);
console.log(`  vidéos préservées        : ${keptVideos}`);
console.log(`  étude de cas Nadia       : ${(parsed.blocks[1] as AnyRec).payload.caseStudy.structuredSteps.length} étapes structurées`);
console.log(`  cas transversal Sylvie   : ${(parsed.blocks[3] as AnyRec).payload.transversalCase ? "oui" : "non"}`);
console.log(`  journal Bloc 4           : J+${(parsed.blocks[4] as AnyRec).payload.journal.entries.map((e: AnyRec) => e.day).join(", J+")}`);
console.log(`  lettres diagnostic       : ${dq.questions.filter((q: AnyRec) => !q.profiling && q.correctKey === "C").length} × C sur ${dq.questions.filter((q: AnyRec) => !q.profiling).length} notées`);
await prisma.$disconnect();
