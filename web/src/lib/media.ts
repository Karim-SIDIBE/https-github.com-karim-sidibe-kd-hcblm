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
  // Prefer transcoded renditions (known bitrate, web-safe H.264) over the raw
  // "source" upload (bitrate unknown), which may not be browser-playable.
  const transcoded = renditions.filter((r) => r.bitrateKbps != null);
  const list = transcoded.length ? transcoded : renditions;
  const eff = conn.effectiveType ?? "";
  if (conn.saveData || eff === "slow-2g" || eff === "2g") return list[0]!; // lowest
  if (eff === "3g") return list[Math.min(1, list.length - 1)]!;            // low-mid
  return list[list.length - 1]!;                                          // best (4g/unknown)
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
  const online = Boolean(manifest?.renditions?.length);
  const ladder = online ? manifest!.renditions : (offlineRenditions ?? []);
  // OFFLINE, only the lightest (downloadable) rendition was cached by
  // « Rendre disponible hors ligne » — picking anything else guarantees a
  // cache miss. Online keeps the connection-aware choice.
  const pick = online
    ? pickRendition(ladder, conn)
    : ladder.filter((r) => r.downloadable !== false && r.url).sort((a, b) => (a.bitrateKbps ?? 1e9) - (b.bitrateKbps ?? 1e9))[0] ?? pickRendition(ladder, conn);
  const url = pick?.url ?? (video.url && video.url.trim() ? video.url : null);
  const captionsUrl = manifest?.captions?.[0]?.url ?? (video.subtitlesUrl || null);
  return { url, captionsUrl, quality: pick?.label ?? null };
}
