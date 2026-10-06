/**
 * patch-grille-communication-n1.ts — charger la grille certifiante OFFICIELLE
 * du parcours Communication professionnelle N1 (Annexe v1.0 + socle v1.1).
 *
 * Contexte (07/10/2026) : le parcours a été importé depuis le document Word du
 * cours, qui ne publie aucune pondération (« l'annexe et le socle font foi ») —
 * l'import avait donc posé une grille PAR DÉFAUT (4 × 25 points, sans minima,
 * sans bandes). Ce script applique la grille de l'annexe via le moteur commun
 * apply-rubric.ts (remplacement en place, revalidation avant écriture,
 * inscriptions préservées, idempotent). Exécuté en production le 07/10/2026
 * (20 versions patchées).
 *
 * Usage :
 *   docker compose -f deploy/docker-compose.yml exec api \
 *     npx tsx prisma/patch-grille-communication-n1.ts [slug]
 */
import { applyRubricToCourse } from "./apply-rubric.js";
import { annexeCommunicationN1Rubric } from "../src/domain/fixtures/annexe-communication-n1.js";

const SLUG = process.argv[2] ?? "communication-professionnelle-en-environnements-professionnels-africains";

await applyRubricToCourse(SLUG, annexeCommunicationN1Rubric, "annexe v1.0 : D1 4×15 min.8 + S1 15/8 + S2 15 + S3 10, seuil 70/100");
