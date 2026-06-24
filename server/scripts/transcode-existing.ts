/**
 * transcode-existing.ts — backfill the adaptive rendition ladder for videos that
 * were uploaded before transcoding ran (they only have the raw `source`).
 *
 * Run inside the API container (ffmpeg is in the image):
 *   docker compose exec api npx tsx scripts/transcode-existing.ts
 *
 * Idempotent: skips assets whose ladder is already complete. Heavy (ffmpeg) —
 * processes sequentially and logs progress; safe to re-run if interrupted.
 */
import { prisma } from "../src/db/prisma.js";
import { processVideo, ffmpegAvailable, LADDER } from "../src/lib/media/transcode.js";

async function main() {
  if (!ffmpegAvailable()) {
    console.error("✗ ffmpeg introuvable dans ce conteneur — impossible de transcoder.");
    process.exit(1);
  }
  const assets = await prisma.mediaAsset.findMany({ where: { kind: "VIDEO" }, include: { renditions: true } });
  const ladderLabels = LADDER.map((l) => l.label);
  console.log(`${assets.length} vidéo(s) à examiner. Échelle cible : ${ladderLabels.join(", ")}\n`);

  let done = 0, skipped = 0;
  for (const a of assets) {
    const source = a.renditions.find((r) => r.label === "source");
    if (!source?.storageKey) { console.log(`- ${a.id}: pas de source stockée → ignoré`); skipped++; continue; }
    const complete = ladderLabels.every((l) => a.renditions.some((r) => r.label === l && r.available));
    if (complete) { console.log(`- ${a.id}: échelle déjà complète → ignoré`); skipped++; continue; }

    console.log(`▶ ${a.id} ${a.originalFilename ?? ""} — transcodage en cours…`);
    const t0 = Date.now();
    const r = await processVideo({ id: a.id, mime: a.mime, storageKey: source.storageKey, sizeBytes: source.sizeBytes });
    // Replace every non-source rendition with the freshly produced ladder.
    await prisma.mediaRendition.deleteMany({ where: { assetId: a.id, label: { not: "source" } } });
    const fresh = r.renditions.filter((s) => s.label !== "source");
    if (fresh.length) await prisma.mediaRendition.createMany({ data: fresh.map((s) => ({ assetId: a.id, ...s })) });
    await prisma.mediaAsset.update({ where: { id: a.id }, data: { status: "READY", durationSec: r.durationSec ?? a.durationSec } });

    const ok = fresh.filter((s) => s.available).map((s) => s.label);
    console.log(`  ✓ ${a.id}: rendus disponibles → ${ok.length ? ok.join(", ") : "(aucun)"}  [${Math.round((Date.now() - t0) / 1000)}s]\n`);
    done++;
  }
  console.log(`\nTerminé. ${done} transcodée(s), ${skipped} ignorée(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
