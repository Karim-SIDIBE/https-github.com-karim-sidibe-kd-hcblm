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

    // Un vieux BROUILLON peut porter des erreurs de contenu préexistantes,
    // étrangères à la grille (recette du 07/10/2026 : un brouillon v24 avec un
    // audit de durées A2 en échec a stoppé le script AVANT la version publiée).
    // Règle : si le contenu était DÉJÀ invalide avant patch, on l'ignore avec
    // un avertissement — la grille y sera posée quand le brouillon sera réparé
    // dans la console. On n'abandonne que si c'est LE PATCH qui casse une
    // version jusque-là valide (la grille ne doit jamais publier d'invalide).
    const preShape = validateShape(JSON.parse(JSON.stringify(content)));
    const preInvalid = !preShape.ok || !validatePolicy(preShape.content).publishable;

    cert.payload.rubric = JSON.parse(JSON.stringify(rubric));
    const shape = validateShape(content);
    const policy = shape.ok ? validatePolicy(shape.content) : null;
    if (!shape.ok || !policy?.publishable) {
      const issues = !shape.ok
        ? shape.issues.slice(0, 5).map((i) => `${i.path}: ${i.message}`)
        : policy!.issues.filter((i) => i.level === "error").slice(0, 5).map((e) => `${e.rule} (${e.path}) — ${e.message}`);
      if (preInvalid) {
        console.log(`⚠ v${v.version} (${v.status}) : contenu invalide AVANT patch (erreur préexistante, étrangère à la grille) — version ignorée :`);
        for (const i of issues) console.log(`   - ${i}`);
        skipped++;
        continue;
      }
      console.error(`✗ v${v.version} (${v.status}) : le patch rend invalide une version jusque-là valide — abandon :`);
      for (const i of issues) console.error(`   ✗ ${i}`);
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
