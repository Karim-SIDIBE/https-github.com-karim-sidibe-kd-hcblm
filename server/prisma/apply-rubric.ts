/**
 * apply-rubric.ts — moteur commun des scripts « charger la grille officielle
 * d'une annexe de parcours » (patch-grille-*.ts).
 *
 * Remplace EN PLACE la grille (blocks[CERTIFICATION].payload.rubric) de chaque
 * version du cours — publiées ET brouillons — après REVALIDATION du contenu
 * complet (shape + portail de publication) : si la grille ne passait pas,
 * rien n'est écrit. Les lignes CourseVersion gardent leur id, donc
 * inscriptions, progression et Moments d'Ancrage sont préservés ; le reste du
 * dossier n'est pas touché (« le dossier évalué reste inchangé », annexes §1).
 * Les versions publiées sont réindexées (recherche). Idempotent — la
 * comparaison passe par le schéma pour neutraliser l'ordre des clés que la
 * normalisation Zod impose au contenu stocké.
 */
import { prisma } from "../src/db/prisma.js";
import { validateShape, validatePolicy } from "../src/domain/validation.js";
import { RubricSchema, type Rubric } from "../src/domain/content-model.js";
import { indexCourseVersion } from "../src/modules/search/search.service.js";

const norm = (r: unknown) => { try { return JSON.stringify(RubricSchema.parse(r)); } catch { return "∅"; } };

export async function applyRubricToCourse(slug: string, rubric: Rubric, summary: string) {
  const course = await prisma.course.findUnique({ where: { slug }, include: { versions: { orderBy: { version: "asc" } } } });
  if (!course) {
    const all = await prisma.course.findMany({ select: { slug: true } });
    console.error(`✗ Aucun cours avec le slug « ${slug} ». Slugs disponibles : ${all.map((c) => c.slug).join(", ")}`);
    process.exit(1);
  }

  let patched = 0, skipped = 0;
  for (const v of course.versions) {
    const content = v.content as { blocks?: { type?: string; payload?: { rubric?: unknown } }[] } | null;
    const cert = content?.blocks?.find((b) => b?.type === "CERTIFICATION");
    if (!cert?.payload) { console.log(`- v${v.version} (${v.status}) : pas de bloc CERTIFICATION — ignorée`); skipped++; continue; }
    if (norm(cert.payload.rubric) === norm(rubric)) {
      console.log(`- v${v.version} (${v.status}) : grille déjà conforme — rien à faire`);
      skipped++;
      continue;
    }

    cert.payload.rubric = JSON.parse(JSON.stringify(rubric));
    const shape = validateShape(content);
    if (!shape.ok) {
      console.error(`✗ v${v.version} (${v.status}) : le contenu patché échoue la validation de SHAPE :`);
      for (const i of shape.issues.slice(0, 10)) console.error(`   - ${i.path}: ${i.message}`);
      process.exit(1);
    }
    const policy = validatePolicy(shape.content);
    if (!policy.publishable) {
      console.error(`✗ v${v.version} (${v.status}) : le contenu patché n'est pas publiable :`);
      for (const e of policy.issues.filter((i) => i.level === "error")) console.error(`   ✗ ${e.rule} (${e.path}) — ${e.message}`);
      process.exit(1);
    }
    for (const w of policy.issues.filter((i) => i.level === "warning")) console.log(`   ⚠ v${v.version} : ${w.rule} — ${w.message}`);

    await prisma.courseVersion.update({ where: { id: v.id }, data: { content: shape.content as unknown as object } });
    if (v.status === "PUBLISHED") {
      try { await indexCourseVersion(v.id); } catch (e) { console.log(`   (réindexation : ${e instanceof Error ? e.message : e})`); }
    }
    console.log(`✓ v${v.version} (${v.status}) : grille remplacée — ${summary}`);
    patched++;
  }

  console.log(`\nTerminé : ${patched} version(s) patchée(s), ${skipped} inchangée(s). Les inscriptions existantes sont préservées.`);
}
