/**
 * relink-media.ts — RÉCUPÉRATION des liaisons vidéo ↔ média perdues.
 *
 * Contexte : un patch de contenu antérieur (patch-v2_1 avant correctif) a
 * réécrit le contenu publié depuis le fixture, effaçant les `video.mediaId`
 * configurés dans l'éditeur. Résultat : les vidéos s'affichent « indisponibles »
 * côté apprenant, alors que les fichiers existent toujours dans la Médiathèque.
 *
 * Ce script NE réécrit PAS le contenu depuis le fixture. Il se contente de
 * remettre une source sur chaque vidéo SANS source, dans l'ordre suivant :
 *   1. liaisons retrouvées dans une autre version du cours (brouillon/archive) ;
 *   2. à défaut, appariement automatique par durée exacte avec un média READY
 *      encore non attribué (une seule correspondance → sûr).
 * Il affiche un rapport (slot ↔ média) à vérifier dans l'éditeur, puis réindexe.
 *
 * Idempotent : ne touche que les vidéos sans source. Les liaisons déjà valides
 * sont conservées.
 *
 * Usage : docker compose -f deploy/docker-compose.yml exec api npx tsx prisma/relink-media.ts
 */
import { CourseStatus } from "../src/generated/prisma/client.js";
import { prisma } from "../src/db/prisma.js";
import { applyMediaBindings, collectMediaBindings, mergeBindings, unboundSlots, type VideoBinding } from "../src/domain/media-bindings.js";
import { indexCourseVersion } from "../src/modules/search/search.service.js";

const SLUG = "gestion-du-temps-n1";

type VideoLike = { mediaId?: string; url?: string; durationSec?: number };
type BlockLike = { index?: number; payload?: Record<string, unknown> };

/** Iterate video slots of a content doc (same slot keys as media-bindings.ts). */
function forEachVideo(content: { blocks?: BlockLike[] }, fn: (key: string, v: VideoLike) => void) {
  for (const b of content.blocks ?? []) {
    const idx = typeof b.index === "number" ? b.index : NaN;
    if (Number.isNaN(idx) || !b.payload) continue;
    const tv = b.payload.triggerVideo as VideoLike | undefined;
    if (tv && typeof tv === "object") fn(`${idx}:trigger`, tv);
    for (const s of (b.payload.microSessions as { id?: string; video?: VideoLike }[] | undefined) ?? []) {
      if (s?.video && s.id) fn(`${idx}:${s.id}`, s.video);
    }
  }
}

async function main() {
  const course = await prisma.course.findUnique({
    where: { slug: SLUG },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!course) { console.error(`✗ Cours « ${SLUG} » introuvable.`); process.exit(1); }
  const published = course.versions.find((v) => v.status === CourseStatus.PUBLISHED);
  if (!published) { console.error("✗ Aucune version publiée."); process.exit(1); }

  const content = JSON.parse(JSON.stringify(published.content)) as { blocks?: BlockLike[] };

  // 1) Restaurer depuis toutes les versions (la plus récente non vide gagne).
  const fromVersions = mergeBindings(course.versions.map((v) => collectMediaBindings(v.content as object)));
  const restored = applyMediaBindings(content, fromVersions);

  // 2) Apparier les slots encore vides par DURÉE exacte avec un média READY unique.
  const assets = await prisma.mediaAsset.findMany({
    where: { kind: "VIDEO", status: "READY" },
    select: { id: true, originalFilename: true, durationSec: true },
  });
  const usedIds = new Set<string>();
  forEachVideo(content, (_k, v) => { if (v.mediaId) usedIds.add(v.mediaId); });

  const byDuration = new Map<number, { id: string; originalFilename: string | null }[]>();
  for (const a of assets) {
    if (a.durationSec == null || usedIds.has(a.id)) continue;
    (byDuration.get(a.durationSec) ?? byDuration.set(a.durationSec, []).get(a.durationSec)!).push(a);
  }
  const autoMatched: { slot: string; assetId: string; filename: string | null; durationSec: number }[] = [];
  forEachVideo(content, (key, v) => {
    if (v.mediaId || (v.url && v.url.trim())) return;
    if (v.durationSec == null) return;
    const candidates = (byDuration.get(v.durationSec) ?? []).filter((a) => !usedIds.has(a.id));
    if (candidates.length === 1) {
      const a = candidates[0]!;
      v.mediaId = a.id; usedIds.add(a.id);
      autoMatched.push({ slot: key, assetId: a.id, filename: a.originalFilename, durationSec: v.durationSec });
    }
  });

  const stillEmpty = unboundSlots(content);

  // 3) Écrire le contenu publié réparé + réindexer.
  if (restored + autoMatched.length > 0) {
    await prisma.courseVersion.update({ where: { id: published.id }, data: { content: content as object } });
    await indexCourseVersion(published.id);
  }

  // 4) Rapport.
  console.log(`\n— Récupération des liaisons vidéo (cours « ${SLUG} », version v${published.version}) —`);
  console.log(`  Restaurées depuis une autre version : ${restored}`);
  console.log(`  Appariées automatiquement par durée : ${autoMatched.length}`);
  for (const m of autoMatched) console.log(`     • ${m.slot}  ←  ${m.filename ?? m.assetId} (${m.durationSec}s)`);
  if (stillEmpty.length) {
    console.log(`  ⚠️ ${stillEmpty.length} vidéo(s) SANS source (à lier manuellement dans l'éditeur) : ${stillEmpty.join(", ")}`);
    const free = assets.filter((a) => !usedIds.has(a.id));
    if (free.length) {
      console.log(`  Médias disponibles non attribués :`);
      for (const a of free) console.log(`     • ${a.id}  ${a.originalFilename ?? "(sans nom)"}  ${a.durationSec ?? "?"}s`);
    }
  } else {
    console.log(`  ✅ Toutes les vidéos ont désormais une source.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
