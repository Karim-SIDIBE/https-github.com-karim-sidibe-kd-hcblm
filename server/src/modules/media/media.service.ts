/**
 * media.service.ts — media ingest + adaptive playback.
 */
import { Readable } from "node:stream";
import type { MediaKind, Role } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import * as storage from "../../lib/storage/storage.js";
import { env } from "../../config/env.js";
import { processVideo, ffmpegAvailable } from "../../lib/media/transcode.js";
import { signMediaToken } from "../../lib/auth/jwt.js";
import { CourseContent, type CourseContent as CourseContentT } from "../../domain/content-model.js";
import { computeProgress } from "../../domain/engine/progress.js";
import { isStaff } from "../../domain/auth/permissions.js";

export class MediaError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

// --- access control: a learner may only fetch media of an UNLOCKED block -----

type AccessPrincipal = { id: string; role: Role } | null | undefined;

/** Storage keys are `sources/<assetId>/…` or `renditions/<assetId>/…`. */
export function assetIdFromKey(key: string): string | null {
  const parts = key.replace(/^\/+/, "").split("/");
  return parts.length >= 2 ? parts[1]! : null;
}

/** The block index that references this media asset in the course content, or null. */
function blockIndexForAsset(content: CourseContentT, assetId: string): number | null {
  for (const b of content.blocks) {
    if (b.type === "ONBOARDING" && b.payload.triggerVideo.mediaId === assetId) return b.index;
    if ("microSessions" in b.payload) {
      for (const m of b.payload.microSessions) if (m.video.mediaId === assetId) return b.index;
    }
  }
  return null;
}

/**
 * Tolerant (no-Zod) scan for an asset reference in stored content. Used as a
 * fallback when `CourseContent.parse` fails on an older published version whose
 * shape predates the current schema — we must NOT hard-lock a learner's media
 * just because the stored document fails strict validation. Walks the same
 * touchpoints (trigger video + micro-session videos) defensively.
 */
export function rawReferencesAsset(content: unknown, assetId: string): boolean {
  const blocks = (content as { blocks?: unknown })?.blocks;
  if (!Array.isArray(blocks)) return false;
  for (const b of blocks) {
    const p = (b as { payload?: any })?.payload ?? {};
    if (p?.triggerVideo?.mediaId === assetId) return true;
    if (Array.isArray(p?.microSessions)) {
      for (const m of p.microSessions) if (m?.video?.mediaId === assetId) return true;
    }
  }
  return false;
}

/**
 * Enforce that the caller may access this asset. Staff have full access; a learner
 * is allowed only if one of their enrolments references the asset in a block that
 * is NOT locked by their progress. This closes the hole where any authenticated
 * learner could fetch any media (incl. a not-yet-unlocked block) by id/key.
 *
 * NOTE: this guards media served BY THE API. When a public CDN is configured
 * (MEDIA_PUBLIC_BASE_URL), bytes are served by the CDN and this check no longer
 * applies — locked-block protection then relies on the unguessable UUID keys.
 */
export async function assertAssetAccessible(principal: AccessPrincipal, assetId: string): Promise<void> {
  if (!principal) throw new MediaError(401, "unauthorized", "Authentification requise");
  if (isStaff(principal.role)) return;
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: principal.id },
    include: { courseVersion: true, completions: true },
  });
  for (const e of enrollments) {
    let content: CourseContentT | null = null;
    try { content = CourseContent.parse(e.courseVersion.content); } catch { content = null; }
    if (content) {
      const idx = blockIndexForAsset(content, assetId);
      if (idx == null) continue;
      const progress = computeProgress(
        content,
        e.completions.map((c) => ({ blockIndex: c.blockIndex, itemKey: c.itemKey, scorePct: c.scorePct })),
        Boolean(e.momentAncrage),
      );
      if (progress.blocks.find((b) => b.index === idx)?.state !== "locked") return;
    } else if (rawReferencesAsset(e.courseVersion.content, assetId)) {
      // Stored content fails strict validation (schema drift on an older
      // published version). Block-state gating can't be computed safely, but the
      // learner is legitimately enrolled in a course that references this asset —
      // allow playback rather than hard-locking ALL media behind a parse error.
      return;
    }
  }
  throw new MediaError(403, "block_locked", "Ce contenu n'est pas encore débloqué.");
}

function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime === "text/vtt" || mime === "application/x-subrip") return "CAPTIONS";
  return "VIDEO";
}
function extFromMime(mime: string): string {
  return ({ "video/mp4": "mp4", "video/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3", "image/jpeg": "jpg", "image/png": "png", "text/vtt": "vtt" } as Record<string, string>)[mime] ?? "bin";
}
function extFromName(name?: string): string | null {
  const m = name?.match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1]!.toLowerCase() : null;
}

export async function createFromUpload(params: { filename?: string; mime: string; data: Readable | Buffer; createdById?: string }) {
  const kind = kindFromMime(params.mime);
  const asset = await prisma.mediaAsset.create({
    data: { kind, mime: params.mime, originalFilename: params.filename ?? null, storageKey: "pending", status: "UPLOADED", createdById: params.createdById ?? null },
  });
  const ext = extFromName(params.filename) ?? extFromMime(params.mime);
  const key = `sources/${asset.id}/source.${ext}`;

  try {
    const { sizeBytes } = await storage.put(key, params.data);
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { storageKey: key, sizeBytes, status: "PROCESSING" } });

    let durationSec: number | undefined;
    let specs;
    if (kind === "VIDEO") {
      const r = await processVideo({ id: asset.id, mime: params.mime, storageKey: key, sizeBytes });
      specs = r.renditions; durationSec = r.durationSec;
    } else {
      specs = [{ label: "source", kind, mime: params.mime, storageKey: key, downloadable: true, available: true, sizeBytes }];
    }
    await prisma.mediaRendition.createMany({ data: specs.map((s) => ({ assetId: asset.id, ...s })) });
    return prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: "READY", durationSec: durationSec ?? null }, include: { renditions: true } });
  } catch (e) {
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) } });
    throw e;
  }
}

/** Register an externally hosted asset (provider URL) without uploading bytes. */
export async function registerExternal(params: { url: string; mime: string; durationSec?: number; createdById?: string }) {
  const kind = kindFromMime(params.mime);
  return prisma.mediaAsset.create({
    data: {
      kind, mime: params.mime, storageKey: "external", status: "READY", durationSec: params.durationSec ?? null, createdById: params.createdById ?? null,
      renditions: { create: { label: "source", kind, mime: params.mime, url: params.url, downloadable: false, available: true } },
    },
    include: { renditions: true },
  });
}

/** Media library listing (authoring). Newest first, with available renditions. */
export async function listMedia(limit = 200) {
  const assets = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" }, take: limit,
    include: { renditions: { select: { label: true, available: true } } },
  });
  return assets.map((a) => ({
    id: a.id, kind: a.kind, filename: a.originalFilename, mime: a.mime,
    sizeBytes: a.sizeBytes, durationSec: a.durationSec, status: a.status, error: a.error, createdAt: a.createdAt,
    renditions: a.renditions.filter((r) => r.available).map((r) => r.label),
  }));
}

export async function getAsset(id: string) {
  const a = await prisma.mediaAsset.findUnique({ where: { id }, include: { renditions: true } });
  if (!a) throw new MediaError(404, "not_found", "Média introuvable");
  return a;
}

/** Adaptive manifest: available renditions lowest-bitrate first + a recommended
 *  lite variant for poor connections + caption tracks. */
export async function playbackManifest(id: string) {
  const asset = await getAsset(id);
  const available = asset.renditions.filter((r) => r.available);
  const playable = available
    .filter((r) => r.kind === "VIDEO" || r.kind === "AUDIO")
    .sort((a, b) => (a.bitrateKbps ?? 1e9) - (b.bitrateKbps ?? 1e9));
  // URL resolution order: (1) externally-hosted (Mux/provider) → its own URL;
  // (2) a CDN is configured (MEDIA_PUBLIC_BASE_URL) → the public CDN URL for the
  //     object key (offloads disk/bandwidth from the VPS); (3) default → the
  //     authenticated streaming endpoint on the API. Default behaviour is
  //     unchanged unless MEDIA_PUBLIC_BASE_URL is set.
  const cdn = !!env.MEDIA_PUBLIC_BASE_URL;
  // Without a CDN, native <video> streams from the authenticated API endpoint —
  // but it can't send a Bearer header, so we embed a short-lived signed token.
  const mediaToken = cdn ? null : await signMediaToken(id);
  const labelOf = (rid: string) => asset.renditions.find((x) => x.id === rid)!.label;
  const toUrl = (r: { id: string; url: string | null; storageKey: string | null }) =>
    r.url ?? (cdn && r.storageKey ? storage.publicUrl(r.storageKey) : `/api/v1/media/${id}/download?label=${encodeURIComponent(labelOf(r.id))}&t=${mediaToken}`);
  const recommendedLite = playable.find((r) => r.downloadable) ?? playable[0];

  return {
    assetId: id,
    status: asset.status,
    durationSec: asset.durationSec,
    ffmpeg: ffmpegAvailable(),
    renditions: playable.map((r) => ({ label: r.label, kind: r.kind, bitrateKbps: r.bitrateKbps, height: r.height, downloadable: r.downloadable, url: toUrl(r) })),
    recommendedLite: recommendedLite ? recommendedLite.label : null,
    captions: available.filter((r) => r.kind === "CAPTIONS").map((r) => ({ label: r.label, language: r.language, url: toUrl(r) })),
  };
}

export async function resolveRendition(assetId: string, label: string) {
  const r = await prisma.mediaRendition.findFirst({ where: { assetId, label } });
  if (!r || !r.available) throw new MediaError(404, "no_rendition", "Rendition indisponible");
  return r;
}

/** Course versions (title + version) whose content still references this asset.
 *  Used to block deletion of media that a published/draft course depends on. */
export async function assetReferences(assetId: string): Promise<string[]> {
  const versions = await prisma.courseVersion.findMany({ select: { title: true, version: true, content: true } });
  const out = new Set<string>();
  for (const v of versions) if (rawReferencesAsset(v.content, assetId)) out.add(`${v.title} (v${v.version})`);
  return [...out];
}

/** Delete a media asset: its stored objects (source + renditions) + DB rows.
 *  Refuses if any course still references it — unlink it in the editor first. */
export async function deleteMedia(assetId: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId }, include: { renditions: true } });
  if (!asset) throw new MediaError(404, "not_found", "Média introuvable");
  const refs = await assetReferences(assetId);
  if (refs.length) {
    throw new MediaError(409, "in_use", `Vidéo utilisée par : ${refs.join(", ")}. Déliez-la d'abord dans l'éditeur de cours, puis réessayez.`);
  }
  // Remove stored objects (best-effort: a missing file shouldn't block the delete).
  const keys = new Set<string>();
  if (asset.storageKey && !["external", "pending"].includes(asset.storageKey)) keys.add(asset.storageKey);
  for (const r of asset.renditions) if (r.storageKey) keys.add(r.storageKey);
  for (const k of keys) await storage.remove(k).catch(() => {});
  await prisma.mediaAsset.delete({ where: { id: assetId } }); // cascades to renditions
  return { id: assetId, removedObjects: keys.size };
}
