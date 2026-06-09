/**
 * patch-v2_1.ts — recharger le parcours canonique en v2.1 SANS perte de données.
 *
 * Contrairement à seed.ts (qui fait `course.deleteMany` → cascade sur toutes les
 * inscriptions), ce script met à jour EN PLACE le `content` JSON de la version
 * PUBLIÉE existante. La ligne CourseVersion garde le même id, donc toutes les
 * inscriptions, la progression, les Moments d'Ancrage et les soumissions sont
 * préservés. Tous les apprenants (actuels et futurs) reçoivent le contenu v2.1
 * (objectif + unités auditables).
 *
 * Idempotent. À utiliser dès qu'il existe ≥ 1 inscription sur le cours.
 * Usage : docker compose -f deploy/docker-compose.yml exec api npx tsx prisma/patch-v2_1.ts
 */
import { PrismaClient, CourseStatus } from "@prisma/client";
import { validateShape, validatePolicy } from "../src/domain/validation.js";
import { indexCourseVersion } from "../src/modules/search/search.service.js";
import { courseUnitTotals } from "../src/domain/content-model.js";
import { n1Full } from "../src/domain/fixtures/n1-full.js";

const prisma = new PrismaClient();
const SLUG = "gestion-du-temps-n1";

async function main() {
  // 1. Valider le contenu v2.1 avant de toucher la base.
  const shape = validateShape(n1Full);
  if (!shape.ok) {
    console.error("✗ Le parcours v2.1 échoue la validation de SHAPE :");
    for (const i of shape.issues) console.error(`   - ${i.path}: ${i.message}`);
    process.exit(1);
  }
  const policy = validatePolicy(shape.content);
  if (!policy.publishable) {
    console.error("✗ Le parcours v2.1 n'est pas publiable :");
    for (const e of policy.issues.filter((i) => i.level === "error")) console.error(`   ✗ ${e.rule} (${e.path}) — ${e.message}`);
    process.exit(1);
  }
  const c = shape.content;

  // 2. Retrouver la version PUBLIÉE la plus récente du cours (sans la supprimer).
  const course = await prisma.course.findUnique({
    where: { slug: SLUG },
    include: { versions: { where: { status: CourseStatus.PUBLISHED }, orderBy: { version: "desc" }, take: 1 } },
  });
  if (!course) {
    console.error(`✗ Cours « ${SLUG} » introuvable. Sur un environnement vierge, utilise plutôt seed.ts.`);
    process.exit(1);
  }
  const v = course.versions[0];
  if (!v) {
    console.error(`✗ Aucune version PUBLIÉE pour « ${SLUG} ». Rien à patcher.`);
    process.exit(1);
  }

  // 3. Mettre à jour EN PLACE le contenu de cette version (même id → FKs intactes).
  const before = await prisma.enrollment.count({ where: { courseId: course.id } });
  await prisma.courseVersion.update({
    where: { id: v.id },
    data: {
      title: c.title,
      domainCode: c.domain.code,
      domainLabel: c.domain.label,
      passThreshold: c.passThreshold,
      content: c as unknown as object,
    },
  });

  // 4. Réindexer la recherche sémantique pour cette version.
  const idx = await indexCourseVersion(v.id);

  // 5. Vérifier que rien n'a été perdu.
  const after = await prisma.enrollment.count({ where: { courseId: course.id } });
  const totals = courseUnitTotals(c.blocks as unknown as { units?: { type: string }[] | null }[]);
  console.log(`\n✓ Version v${v.version} (${v.id}) mise à jour en v2.1 — EN PLACE, aucune suppression.`);
  console.log(`  Objectif     : ${c.objective ? "présent" : "ABSENT"}`);
  console.log(`  Unités       : ${totals.microSessions} micro-sessions · ${totals.longActivities} activités longues · ${totals.microTasks} micro-tâches`);
  console.log(`  Index        : ${idx.chunks} chunks (${idx.model})`);
  console.log(`  Inscriptions : ${before} avant → ${after} après (préservées)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
