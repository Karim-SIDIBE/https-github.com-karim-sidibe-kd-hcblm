/**
 * sync-bloc4-consignes.ts — aligne les CONSIGNES du Bloc 4 sur les attentes de
 * la grille (retour terrain 11/09 : un apprenant qui suivait fidèlement les
 * consignes pouvait échouer S1/S2 sans avoir été prévenu) :
 *
 *   - journal J+11 : demande désormais de situer la charge de travail et de
 *     décrire un signal de surcharge/décrochage + l'ajustement fait (clause
 *     d'exclusion du critère S1) ;
 *   - Section 5 (Apprentissage personnel) : demande une difficulté concrète
 *     rencontrée pendant la période et une croyance révisée / une chose qui
 *     n'a pas fonctionné (bandes hautes du critère S2).
 *
 * Patch EN PLACE de la version publiée (comme sync-parcours-v21) : la grille
 * est INCHANGÉE (aucune recalibration exigée), les clés d'items sont
 * inchangées (aucune complétion invalidée), les inscriptions ne bougent pas.
 * Les nouveaux textes viennent de la fixture (source de vérité) ; le résultat
 * est validé contre le contrat Zod + la barrière de publication AVANT écriture.
 *
 * Usage (prod) : docker compose ... exec api npx tsx scripts/sync-bloc4-consignes.ts
 * Usage (dev)  : npx tsx scripts/sync-bloc4-consignes.ts [courseId]
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
  throw new Error("Parcours introuvable — passez un courseId en argument.");
}

const courseId = await resolveCourseId();
const version = await prisma.courseVersion.findFirst({ where: { courseId, status: "PUBLISHED" }, orderBy: { version: "desc" } });
if (!version) throw new Error(`Aucune version publiée pour le parcours ${courseId}.`);

type AnyRec = Record<string, any>;
const fixtureCert = (n1Full as AnyRec).blocks.find((b: AnyRec) => b.type === "CERTIFICATION");
const next: AnyRec = JSON.parse(JSON.stringify(version.content));
const cert = (next.blocks as AnyRec[]).find((b) => b.type === "CERTIFICATION");
if (!cert || !fixtureCert) throw new Error("Bloc CERTIFICATION absent (contenu ou fixture).");

// J+11 : prompt + placeholder depuis la fixture (jour apparié, jamais l'index).
const fx11 = fixtureCert.payload.journal.entries.find((e: AnyRec) => e.day === 11);
const cur11 = cert.payload.journal.entries.find((e: AnyRec) => e.day === 11);
if (!fx11 || !cur11) throw new Error("Entrée J+11 absente (contenu ou fixture).");
const promptChanged = cur11.prompt !== fx11.prompt;
cur11.prompt = fx11.prompt;
cur11.placeholder = fx11.placeholder;

// Section 5 (index 4) : helpText depuis la fixture.
const fxS5 = fixtureCert.payload.sections[4];
const curS5 = cert.payload.sections[4];
if (!fxS5 || !curS5) throw new Error("Section 5 absente (contenu ou fixture).");
const helpChanged = curS5.helpText !== fxS5.helpText;
curS5.helpText = fxS5.helpText;

const parsed = CourseContent.parse(next); // jamais écrire un contenu invalide
const policy = validatePolicy(parsed);
if (!policy.publishable) {
  console.error(policy.issues.filter((i) => i.level === "error"));
  throw new Error("Le contenu patché ne passe pas la barrière de publication — rien n'a été écrit.");
}

await prisma.courseVersion.update({ where: { id: version.id }, data: { content: parsed as unknown as object, updatedAt: new Date() } });
console.log(`Consignes Bloc 4 alignées sur la grille (${courseId}, v${version.version}) :`);
console.log(`  journal J+11 : ${promptChanged ? "prompt mis à jour (charge de travail + signal de surcharge + ajustement)" : "déjà à jour"}`);
console.log(`  Section 5    : ${helpChanged ? "helpText mis à jour (difficulté rencontrée + croyance révisée)" : "déjà à jour"}`);
console.log(`  grille       : inchangée — calibration conservée ; clés d'items inchangées — complétions intactes`);
await prisma.$disconnect();
