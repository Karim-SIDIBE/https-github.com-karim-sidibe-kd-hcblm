/**
 * sync-parcours-rt3.ts — aligne le contenu PUBLIÉ avec le lot RT3 (retours de
 * test, arbitrages A3 + passe de consignes explicites) :
 *
 *   - A3 : les nationalités individuelles disparaissent des scénarios (quiz
 *     diagnostique, interbloc, final, cas Nadia/Sylvie) — le cadrage africain
 *     (villes, « organisation africaine », prénoms) est conservé ;
 *   - consignes explicites : 1.3 (attendu détaillé + exemples grisés),
 *     1.4 (« 3 gestes » du rituel, plus d'ambiguïté avec les champs),
 *     2.1 (« temps de fond » explicité), 2.2 (ordre d'importance + buffer
 *     chiffré), Étape 2 terrain (« hiérarchie et collègues »), d5 (« réalisée
 *     à 60 % »), échelle d'auto-évaluation, journal J+2 (« la solution choisie
 *     dans la formation »), pair de progression explicité au plan d'action.
 *
 * Fusion : le NOUVEAU FIXTURE est la source de vérité pour ces textes, en
 * PRÉSERVANT ce que la production possède : vidéos liées (mediaId/url/durées),
 * vidéo déclencheuse, itemOrder déclaré par l'admin (blocs 0-2), pools de
 * questions. Idempotent ; le résultat est validé par le contrat Zod partagé et
 * la barrière de publication AVANT toute écriture.
 *
 * Usage (prod) :  docker compose ... exec api npx tsx scripts/sync-parcours-rt3.ts
 * Usage (dev)  :  npx tsx scripts/sync-parcours-rt3.ts [courseId]
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

// Le fixture (relu) sert de base ; on regreffe ensuite ce que la prod possède.
const next: AnyRec = JSON.parse(JSON.stringify(n1Full));
next.title = current.title ?? next.title;
next.certificate = current.certificate ?? next.certificate;

let keptVideos = 0;
for (const nb of next.blocks as AnyRec[]) {
  const cb = byIndex.get(nb.index);
  if (!cb) continue;
  // 1) l'arrangement d'affichage déclaré par l'admin survit (blocs 0-2 —
  //    même règle que sync-parcours-v21 : les blocs 3-4 portent le découpage
  //    canonique en groupes, un ancien itemOrder les disperserait).
  if (nb.index < 3 && Array.isArray(cb.itemOrder) && cb.itemOrder.length) nb.itemOrder = cb.itemOrder;
  // 2) les vidéos liées survivent (mediaId, url, durées, sous-titres…)
  if (nb.payload?.triggerVideo && cb.payload?.triggerVideo) { nb.payload.triggerVideo = cb.payload.triggerVideo; keptVideos++; }
  const curMs = new Map<string, AnyRec>((cb.payload?.microSessions ?? []).map((m: AnyRec) => [m.id, m]));
  for (const ms of nb.payload?.microSessions ?? []) {
    const cur = curMs.get(ms.id);
    if (cur?.video) { ms.video = cur.video; keptVideos++; }
  }
  // 3) les pools de questions configurés en prod survivent
  for (const key of ["diagnosticQuiz", "interBlockQuiz", "finalQuiz"]) {
    if (nb.payload?.[key] && cb.payload?.[key]?.pool) nb.payload[key].pool = cb.payload[key].pool;
  }
}

const parsed = CourseContent.parse(next); // jamais un contenu invalide en base
const policy = validatePolicy(parsed);
if (!policy.publishable) {
  console.error(policy.issues);
  throw new Error("Le contenu fusionné ne passe pas la barrière de publication — rien n'a été écrit.");
}

await prisma.courseVersion.update({ where: { id: version.id }, data: { content: parsed as object, updatedAt: new Date() } });
const flat = JSON.stringify(parsed);
const gentiles = flat.match(/ghané\w*|togolais\w*|sénégalais\w*|nigérian\w*|gabonais\w*|camerounais\w*|ivoirien\w*|kényan\w*|tanzanien\w*/gi) ?? [];
console.log(`Parcours RT3 → contenu publié (${courseId}) :`);
console.log(`  vidéos préservées          : ${keptVideos}`);
console.log(`  gentilés individuels       : ${gentiles.length ? gentiles.join(", ") : "aucun ✅"}`);
console.log(`  cadrage africain conservé  : ${(flat.match(/africain/gi) ?? []).length} mentions`);
console.log(`  buffer 2.2 chiffré         : ${flat.includes("un chiffre") ? "oui" : "NON"}`);
console.log(`  étape 2 terrain            : ${flat.includes("(hiérarchie et collègues)") ? "hiérarchie et collègues ✅" : "NON"}`);
await prisma.$disconnect();
