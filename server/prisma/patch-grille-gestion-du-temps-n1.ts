/**
 * patch-grille-gestion-du-temps-n1.ts — charger la grille certifiante de
 * l'Annexe Gestion du Temps N1 v1.2 (novembre 2026, remplace la v1.1) dans
 * le parcours canonique EN PRODUCTION, sans toucher aux inscriptions.
 *
 * La grille v1.2 vit dans la fixture n1-full.ts (source unique : le seed et
 * patch-v2_1 l'utilisent aussi) — ce script l'extrait et l'applique à chaque
 * version du cours via le moteur commun apply-rubric.ts. Voir
 * docs/referentiels/annexe-gestion-du-temps-n1-v1.2.md.
 *
 * Idempotent. Usage :
 *   docker compose -f deploy/docker-compose.yml exec api \
 *     npx tsx prisma/patch-grille-gestion-du-temps-n1.ts [slug]
 */
import { applyRubricToCourse } from "./apply-rubric.js";
import { n1Full } from "../src/domain/fixtures/n1-full.js";
import type { Rubric } from "../src/domain/content-model.js";

const SLUG = process.argv[2] ?? "gestion-du-temps-n1";

const cert = (n1Full as { blocks: { type: string; payload?: { rubric?: Rubric } }[] }).blocks.find((b) => b.type === "CERTIFICATION");
if (!cert?.payload?.rubric) { console.error("✗ fixture n1-full : bloc CERTIFICATION introuvable"); process.exit(1); }

await applyRubricToCourse(SLUG, cert.payload.rubric, "annexe v1.2 : D4 4×15 min.8 (D4.C4 réintégrée) + S1 15/8 + S2 15 + S3 10, seuil 70/100");
