/**
 * seed.ts — ingest the canonical Niveau 1 course.
 *
 * Validates the real course (shape + non-negotiable policy), then persists it as
 * a PUBLISHED CourseVersion authored by a Learning Designer. Idempotent: re-runs
 * reset the canonical course to a clean published v1.
 */
import { PrismaClient, CourseStatus } from "@prisma/client";
import { validateShape, validatePolicy } from "../src/domain/validation.js";
import { hashPassword } from "../src/lib/auth/password.js";
import { indexCourseVersion } from "../src/modules/search/search.service.js";
import { n1Full } from "../src/domain/fixtures/n1-full.js";

const DEV_PASSWORD = "Declick!Dev2026";

const prisma = new PrismaClient();
const SLUG = "gestion-du-temps-n1";

async function main() {
  // 1. Validate the real course before touching the DB.
  const shape = validateShape(n1Full);
  if (!shape.ok) {
    console.error("✗ Le parcours réel échoue la validation de SHAPE :");
    for (const i of shape.issues) console.error(`   - ${i.path}: ${i.message}`);
    process.exit(1);
  }
  const policy = validatePolicy(shape.content);
  const errors = policy.issues.filter((i) => i.level === "error");
  const warnings = policy.issues.filter((i) => i.level === "warning");
  console.log(`Validation : shape OK · policy ${policy.publishable ? "PUBLISHABLE" : "BLOQUÉE"} · ${errors.length} erreur(s), ${warnings.length} avertissement(s)`);
  for (const w of warnings) console.log(`   ⚠ ${w.rule} — ${w.message}`);
  if (!policy.publishable) {
    for (const e of errors) console.error(`   ✗ ${e.rule} (${e.path}) — ${e.message}`);
    process.exit(1);
  }

  // 2. Bootstrap principals (one per key role) for the back-office + clients.
  const bootstrap = [
    { email: "admin@kompetences.net", name: "Super Admin", role: "SUPER_ADMIN" as const },
    { email: "designer@kompetences.net", name: "Learning Designer", role: "LEARNING_DESIGNER" as const },
    { email: "reviewer@kompetences.net", name: "Content Reviewer", role: "REVIEWER" as const },
    { email: "evaluator@kompetences.net", name: "Évaluateur", role: "EVALUATOR" as const },
  ];
  const passwordHash = await hashPassword(DEV_PASSWORD);
  const users: Record<string, { id: string; role: string; email: string }> = {};
  for (const u of bootstrap) {
    const created = await prisma.user.upsert({
      where: { email: u.email }, update: { role: u.role, passwordHash, emailVerifiedAt: new Date() }, create: { ...u, passwordHash, emailVerifiedAt: new Date() },
    });
    users[u.role] = { id: created.id, role: created.role, email: created.email };
  }
  const designer = { id: users.LEARNING_DESIGNER!.id };

  // 3. Reset + create the canonical course (idempotent).
  await prisma.course.deleteMany({ where: { slug: SLUG } });
  const c = shape.content;
  const course = await prisma.course.create({
    data: {
      slug: SLUG,
      authorId: designer.id,
      versions: {
        create: {
          version: 1,
          status: CourseStatus.PUBLISHED,
          publishedAt: new Date(),
          title: c.title,
          level: "L1",
          language: c.language,
          domainCode: c.domain.code,
          domainLabel: c.domain.label,
          passThreshold: c.passThreshold,
          content: c as unknown as object,
        },
      },
    },
    include: { versions: true },
  });

  // 4. Build the semantic-search index for the published version.
  const idx = await indexCourseVersion(course.versions[0]!.id);
  console.log(`  Index sémantique     : ${idx.chunks} chunks (${idx.model})`);

  // 5. Report what was ingested.
  const blocks = c.blocks;
  const microTotal = blocks.reduce(
    (n, b) => n + ("microSessions" in b.payload ? b.payload.microSessions.length : 0),
    0,
  );
  console.log(`\n✓ Parcours canonique publié : ${course.slug} (v${course.versions[0]!.version})`);
  console.log(`  Titre        : ${c.title}`);
  console.log(`  Domaine      : ${c.domain.code} — ${c.domain.label} · Niveau ${c.level} · seuil ${c.passThreshold}%`);
  console.log(`  Blocs        : ${blocks.map((b) => `${b.index}:${b.type}`).join(" · ")}`);
  console.log(`  Micro-sessions vidéo : ${microTotal}`);
  console.log(`  Quiz diagnostique    : ${(blocks[1] as any).payload.diagnosticQuiz.questions.length} questions`);
  console.log(`  Quiz final           : ${(blocks[3] as any).payload.finalQuiz.questions.length} questions`);
  console.log(`  Journal Bloc 4       : ${(blocks[4] as any).payload.journal.entries.length} micro-entrées`);
  console.log(`  Grille D4            : ${(blocks[4] as any).payload.rubric.criteria.length} critères = ${(blocks[4] as any).payload.rubric.criteria.reduce((a: number, x: any) => a + x.weightPoints, 0)}/100`);

  console.log(`\nPrincipals (login via POST /auth/login · mot de passe dev : "${DEV_PASSWORD}") :`);
  for (const [role, u] of Object.entries(users)) console.log(`  ${role.padEnd(18)} ${u.email}  (${u.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
