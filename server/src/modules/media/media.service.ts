/**
 * media.service.ts — media ingest + adaptive playback.
 */
import { Readable } from "node:stream";
import type { MediaKind } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import * as storage from "../../lib/storage/storage.js";
import { env } from "../../config/env.js";
import { processVideo, ffmpegAvailable } from "../../lib/media/transcode.js";

export class MediaError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
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
  const labelOf = (rid: string) => asset.renditions.find((x) => x.id === rid)!.label;
  const toUrl = (r: { id: string; url: string | null; storageKey: string | null }) =>
    r.url ?? (cdn && r.storageKey ? storage.publicUrl(r.storageKey) : `/api/v1/media/${id}/download?label=${encodeURIComponent(labelOf(r.id))}`);
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
