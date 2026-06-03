/**
 * media.ts — adaptive source resolution (§4.3 / §9).
 *
 * Renditions come bitrate-sorted (lowest first) from the online playback
 * manifest or, offline, from the cached bundle's rendition ladder. We pick a
 * quality from the live connection so playback starts low on 2G/3G/Save-Data
 * and only steps up when the network allows — keeping the 200 kbps floor usable.
 * Pure + unit-tested.
 */
export type Rendition = { label: string; bitrateKbps?: number | null; url: string; downloadable?: boolean };
export type Conn = { effectiveType?: string; saveData?: boolean };
export type PlaybackManifest = {
  renditions: Rendition[];
  recommendedLite?: string | null;
  captions?: { label: string; language?: string; url: string }[];
};

/** Pick a rendition (assumed lowest-bitrate first) for the connection. */
export function pickRendition(renditions: Rendition[], conn: Conn = {}): Rendition | null {
  if (!renditions.length) return null;
  const eff = conn.effectiveType ?? "";
  if (conn.saveData || eff === "slow-2g" || eff === "2g") return renditions[0]!; // lowest
  if (eff === "3g") return renditions[Math.min(1, renditions.length - 1)]!;       // low-mid
  return renditions[renditions.length - 1]!;                                       // best (4g/unknown)
}

/** Read the live connection (Network Information API; empty when unsupported). */
export function currentConn(): Conn {
  const c = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  return { effectiveType: c?.effectiveType, saveData: c?.saveData };
}

export type VideoSource = { url: string | null; captionsUrl: string | null; quality: string | null };

/** Resolve the playable source: online manifest → offline ladder → raw URL.
 *  Captions: manifest track → the content's own subtitlesUrl. */
export function resolveSource(
  video: { url?: string; subtitlesUrl?: string },
  manifest: PlaybackManifest | null,
  offlineRenditions: Rendition[] | null,
  conn: Conn = {},
): VideoSource {
  const ladder = manifest?.renditions?.length ? manifest.renditions : (offlineRenditions ?? []);
  const pick = pickRendition(ladder, conn);
  const url = pick?.url ?? (video.url && video.url.trim() ? video.url : null);
  const captionsUrl = manifest?.captions?.[0]?.url ?? (video.subtitlesUrl || null);
  return { url, captionsUrl, quality: pick?.label ?? null };
}
