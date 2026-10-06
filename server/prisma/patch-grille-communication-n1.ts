/**
 * patch-grille-communication-n1.ts — charger la grille certifiante OFFICIELLE
 * du parcours Communication professionnelle N1 (Annexe v1.0 + socle v1.1).
 *
 * Contexte (07/10/2026) : le parcours a été importé depuis le document Word du
 * cours, qui ne publie aucune pondération (« l'annexe et le socle font foi »).
 * L'import avait donc posé une grille PAR DÉFAUT (4 × 25 points, sans minima,
 * sans bandes). Ce script remplace EN PLACE la grille de chaque version du
 * cours (publiées ET brouillons) par la grille de l'annexe — les lignes
 * CourseVersion gardent leur id, donc inscriptions, progression et Moments
 * d'Ancrage sont préservés. Le reste du contenu (sections, journal, textes)
 * n'est pas touché : « le dossier évalué reste inchangé » (annexe §1).
 *
 * Chaque version patchée est revalidée (shape + policy) AVANT écriture — si la
 * grille ne passait pas le portail de publication, rien n'est modifié.
 *
 * Idempotent. Usage :
 *   docker compose -f deploy/docker-compose.yml exec api \
 *     npx tsx prisma/patch-grille-communication-n1.ts [slug]
 */
import { prisma } from "../src/db/prisma.js";
import { validateShape, validatePolicy } from "../src/domain/validation.js";
import { RubricSchema } from "../src/domain/content-model.js";
import { indexCourseVersion } from "../src/modules/search/search.service.js";
import { annexeCommunicationN1Rubric } from "../src/domain/fixtures/annexe-communication-n1.js";

const SLUG = process.argv[2] ?? "communication-professionnelle-en-environnements-professionnels-africains";

// Comparaison d'idempotence : via le schéma, pour neutraliser l'ordre des clés
// que la normalisation Zod impose au contenu stocké.
const norm = (r: unknown) => { try { return JSON.stringify(RubricSchema.parse(r)); } catch { return "∅"; } };

async function main() {
  const course = await prisma.course.findUnique({ where: { slug: SLUG }, include: { versions: { orderBy: { version: "asc" } } } });
  if (!course) {
    const all = await prisma.course.findMany({ select: { slug: true } });
    console.error(`✗ Aucun cours avec le slug « ${SLUG} ». Slugs disponibles : ${all.map((c) => c.slug).join(", ")}`);
    process.exit(1);
  }

  let patched = 0, skipped = 0;
  for (const v of course.versions) {
    const content = v.content as { blocks?: { type?: string; payload?: { rubric?: unknown } }[] } | null;
    const cert = content?.blocks?.find((b) => b?.type === "CERTIFICATION");
    if (!cert?.payload) { console.log(`- v${v.version} (${v.status}) : pas de bloc CERTIFICATION — ignorée`); skipped++; continue; }
    if (norm(cert.payload.rubric) === norm(annexeCommunicationN1Rubric)) {
      console.log(`- v${v.version} (${v.status}) : grille déjà conforme à l'annexe v1.0 — rien à faire`);
      skipped++;
      continue;
    }

    // Remplacer la grille puis REVALIDER le contenu complet avant d'écrire.
    cert.payload.rubric = JSON.parse(JSON.stringify(annexeCommunicationN1Rubric));
    const shape = validateShape(content);
    if (!shape.ok) {
      console.error(`✗ v${v.version} (${v.status}) : le contenu patché échoue la validation de SHAPE :`);
      for (const i of shape.issues.slice(0, 10)) console.error(`   - ${i.path}: ${i.message}`);
      process.exit(1);
    }
    const policy = validatePolicy(shape.content);
    const errors = policy.issues.filter((i) => i.level === "error");
    if (!policy.publishable) {
      console.error(`✗ v${v.version} (${v.status}) : le contenu patché n'est pas publiable :`);
      for (const e of errors) console.error(`   ✗ ${e.rule} (${e.path}) — ${e.message}`);
      process.exit(1);
    }
    for (const w of policy.issues.filter((i) => i.level === "warning")) console.log(`   ⚠ v${v.version} : ${w.rule} — ${w.message}`);

    await prisma.courseVersion.update({ where: { id: v.id }, data: { content: shape.content as unknown as object } });
    if (v.status === "PUBLISHED") {
      try { await indexCourseVersion(v.id); } catch (e) { console.log(`   (réindexation : ${e instanceof Error ? e.message : e})`); }
    }
    const r = annexeCommunicationN1Rubric;
    console.log(`✓ v${v.version} (${v.status}) : grille remplacée — ${r.criteria.length} critères (D1 4×15 min.8 + S1 15/8 + S2 15 + S3 10), seuil ${r.threshold}/100`);
    patched++;
  }

  console.log(`\nTerminé : ${patched} version(s) patchée(s), ${skipped} inchangée(s). Les inscriptions existantes sont préservées.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
