/**
 * media.ts — adaptive source resolution (§4.3 / §9).
 *
 * Renditions come bitrate-sorted (lowest first) from the online playback
 * manifest or, offline, from the cached bundle's rendition ladder. We pick a
 * quality from the live connection so playback starts low on 2G/3G/Save-Data
 * and only steps up when the network allows — keeping the 200 kbps floor usable.
 * Pure + unit-tested.
 */
export type Rendition = { label: string; bitrateKbps?: number | null; url: string; downloadable?: boolean; kind?: string; language?: string | null };
export type Conn = { effectiveType?: string; saveData?: boolean };
/** Une piste de sous-titres (fichier VTT/SRT du média, ex. Français + English). */
export type CaptionTrack = { label: string; language?: string | null; url: string };
export type PlaybackManifest = {
  renditions: Rendition[];
  recommendedLite?: string | null;
  captions?: CaptionTrack[];
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

export type VideoSource = { url: string | null; captionsUrl: string | null; captionTracks: CaptionTrack[]; quality: string | null };

/** Resolve the playable source: online manifest → offline ladder → raw URL.
 *  Captions (toutes les pistes, ex. FR + EN) : manifest → renditions CAPTIONS
 *  du bundle hors-ligne → le subtitlesUrl du contenu (piste FR unique). */
export function resolveSource(
  video: { url?: string; subtitlesUrl?: string },
  manifest: PlaybackManifest | null,
  offlineRenditions: Rendition[] | null,
  conn: Conn = {},
  cachedUrls: string[] = [],
): VideoSource {
  const online = Boolean(manifest?.renditions?.length);
  // Les pistes de sous-titres ne sont jamais des sources vidéo candidates.
  const ladder = (online ? manifest!.renditions : (offlineRenditions ?? [])).filter((r) => r.kind !== "CAPTIONS");
  const captionTracks: CaptionTrack[] = (manifest?.captions?.length
    ? manifest.captions
    : (offlineRenditions ?? []).filter((r) => r.kind === "CAPTIONS").map((r) => ({ label: r.label, language: r.language, url: r.url }))
  ).filter((c) => c.url);
  if (!captionTracks.length && video.subtitlesUrl) captionTracks.push({ label: "Français", language: "fr", url: video.subtitlesUrl });
  // OFFLINE, serve exactly what « Rendre disponible hors ligne » put in the
  // cache (the registry knows the urls); fall back to the lightest rendition.
  const pick = online
    ? pickRendition(ladder, conn)
    : ladder.find((r) => r.url && cachedUrls.includes(r.url))
      ?? ladder.filter((r) => r.downloadable !== false && r.url).sort((a, b) => (a.bitrateKbps ?? 1e9) - (b.bitrateKbps ?? 1e9))[0]
      ?? pickRendition(ladder, conn);
  const url = pick?.url ?? (video.url && video.url.trim() ? video.url : null);
  return { url, captionsUrl: captionTracks[0]?.url ?? null, captionTracks, quality: pick?.label ?? null };
}
