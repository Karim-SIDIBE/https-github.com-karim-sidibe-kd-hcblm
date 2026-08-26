/**
 * migrate-legacy-entitlements.ts — migration « accès offerts » (spec paiement Q4).
 *
 * À l'activation du paiement, convertit les accès EXISTANTS en droits d'accès
 * d'origine LEGACY — personne n'est jamais coupé :
 *  - chaque inscription (user, course) → Entitlement COURSE_ACCESS LEGACY ;
 *  - chaque quota de sièges d'organisation (> 0) → Entitlement SEATS LEGACY
 *    (trace d'origine ; ne modifie PAS Organization.seats, déjà en place).
 *
 * Idempotent : relançable sans doublon (un droit valide existant, quelle que
 * soit son origine, est respecté et compté « déjà couvert »).
 *
 * Usage (prod): docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec api npx tsx scripts/migrate-legacy-entitlements.ts
 * Usage (dev):  npx tsx --env-file-if-exists=.env scripts/migrate-legacy-entitlements.ts
 */
import { prisma } from "../src/db/prisma.js";

async function main() {
  // 1) Inscriptions → droits COURSE_ACCESS LEGACY.
  const enrollments = await prisma.enrollment.findMany({ select: { userId: true, courseId: true } });
  let created = 0, covered = 0;
  for (const e of enrollments) {
    const existing = await prisma.entitlement.findFirst({
      where: { holderUserId: e.userId, scope: "COURSE_ACCESS", courseId: e.courseId, revokedAt: null },
    });
    if (existing) { covered++; continue; }
    await prisma.entitlement.create({
      data: { holderUserId: e.userId, scope: "COURSE_ACCESS", courseId: e.courseId, source: "LEGACY" },
    });
    created++;
  }
  console.log(`✓ Inscriptions : ${created} droit(s) LEGACY créés, ${covered} déjà couverts (${enrollments.length} inscriptions).`);

  // 2) Quotas de sièges → trace SEATS LEGACY (informatif, sans re-créditer).
  const orgs = await prisma.organization.findMany({ where: { seats: { gt: 0 } }, select: { id: true, name: true, seats: true } });
  let orgCreated = 0, orgCovered = 0;
  for (const o of orgs) {
    const existing = await prisma.entitlement.findFirst({ where: { holderOrgId: o.id, scope: "SEATS", revokedAt: null } });
    if (existing) { orgCovered++; continue; }
    await prisma.entitlement.create({ data: { holderOrgId: o.id, scope: "SEATS", seats: o.seats, source: "LEGACY" } });
    orgCreated++;
  }
  console.log(`✓ Organisations : ${orgCreated} trace(s) SEATS LEGACY créées, ${orgCovered} déjà couvertes (${orgs.length} orgs à quota).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
