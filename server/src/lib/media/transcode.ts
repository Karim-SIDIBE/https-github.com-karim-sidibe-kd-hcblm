/**
 * transcode.ts — pluggable video transcoding into an adaptive, low-bandwidth
 * rendition ladder.
 *
 * - When ffmpeg is available → real renditions are produced (480p, 240p-lite,
 *   audio-only) plus a probed duration.
 * - Otherwise → the source is kept as the playable rendition and the ladder is
 *   recorded as `available: false` (planned), so the API surface and offline
 *   manifest are complete; a provider (Mux/Cloudflare Stream) or an ffmpeg worker
 *   can fill them in later. This keeps the platform fully functional offline.
 */
import { spawnSync } from "node:child_process";
import { localPath, sizeOf } from "../storage/storage.js";

export type MediaKindT = "VIDEO" | "AUDIO" | "CAPTIONS" | "IMAGE";

export type RenditionSpec = {
  label: string;
  kind: MediaKindT;
  mime: string;
  storageKey?: string;
  url?: string;
  bitrateKbps?: number;
  width?: number;
  height?: number;
  language?: string;
  sizeBytes?: number;
  downloadable: boolean;
  available: boolean;
};

/** Target ladder, lowest-bandwidth variants flagged downloadable for offline. */
export const LADDER: { label: string; kind: MediaKindT; mime: string; height?: number; bitrateKbps: number; downloadable: boolean; ext: string }[] = [
  { label: "720p", kind: "VIDEO", mime: "video/mp4", height: 720, bitrateKbps: 2000, downloadable: false, ext: "mp4" }, // HD tier (good connections)
  { label: "480p", kind: "VIDEO", mime: "video/mp4", height: 480, bitrateKbps: 800, downloadable: false, ext: "mp4" },
  { label: "240p-lite", kind: "VIDEO", mime: "video/mp4", height: 240, bitrateKbps: 300, downloadable: true, ext: "mp4" },
  { label: "audio", kind: "AUDIO", mime: "audio/mp4", bitrateKbps: 64, downloadable: true, ext: "m4a" },
];

let ffmpegCache: boolean | undefined;
export function ffmpegAvailable(): boolean {
  if (ffmpegCache === undefined) {
    ffmpegCache = spawnSync("ffmpeg", ["-version"]).status === 0;
  }
  return ffmpegCache;
}

function probeDurationSec(path: string): number | undefined {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]);
  if (r.status !== 0) return undefined;
  const d = parseFloat(r.stdout.toString().trim());
  return Number.isFinite(d) ? Math.round(d) : undefined;
}

/**
 * Produce rendition specs for a video asset. The `source` rendition is always
 * present (playable + downloadable); ladder entries are real when ffmpeg exists,
 * otherwise recorded as planned.
 */
export async function processVideo(asset: { id: string; mime: string; storageKey: string; sizeBytes?: number | null }): Promise<{ renditions: RenditionSpec[]; durationSec?: number }> {
  const source: RenditionSpec = {
    label: "source", kind: "VIDEO", mime: asset.mime, storageKey: asset.storageKey,
    downloadable: true, available: true, sizeBytes: asset.sizeBytes ?? undefined,
  };

  if (!ffmpegAvailable()) {
    const planned: RenditionSpec[] = LADDER.map((l) => ({
      label: l.label, kind: l.kind, mime: l.mime, bitrateKbps: l.bitrateKbps, height: l.height,
      downloadable: l.downloadable, available: false,
    }));
    return { renditions: [source, ...planned] };
  }

  const inPath = localPath(asset.storageKey);
  const durationSec = probeDurationSec(inPath);
  const renditions: RenditionSpec[] = [source];

  for (const l of LADDER) {
    const key = `renditions/${asset.id}/${l.label}.${l.ext}`;
    const out = localPath(key);
    const args = l.kind === "AUDIO"
      ? ["-y", "-i", inPath, "-vn", "-c:a", "aac", "-b:a", `${l.bitrateKbps}k`, "-movflags", "+faststart", out]
      // Web-safe H.264: yuv420p for broad decode support + faststart (moov atom up
      // front) so the browser can start playback without downloading the whole file.
      : ["-y", "-i", inPath, "-vf", `scale=-2:${l.height}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-b:v", `${l.bitrateKbps}k`, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out];
    const r = spawnSync("ffmpeg", args, { maxBuffer: 1 << 26 });
    if (r.status === 0) {
      renditions.push({
        label: l.label, kind: l.kind, mime: l.mime, storageKey: key, bitrateKbps: l.bitrateKbps,
        height: l.height, downloadable: l.downloadable, available: true, sizeBytes: await sizeOf(key).catch(() => undefined),
      });
    } else {
      renditions.push({ label: l.label, kind: l.kind, mime: l.mime, bitrateKbps: l.bitrateKbps, height: l.height, downloadable: l.downloadable, available: false });
    }
  }
  return { renditions, durationSec };
}
