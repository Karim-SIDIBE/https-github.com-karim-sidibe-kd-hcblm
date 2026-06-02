/**
 * offline.ts — offline session download (§9 / AC#12).
 *
 * Caches each session's lowest-bitrate video rendition + caption track into the
 * `klms-media` Cache Storage bucket, which the service worker serves CacheFirst
 * (with range requests) so a downloaded session plays with no connectivity. The
 * course text + exercises are already cached in the bundle, so only the video
 * files need explicit download. `blockMediaUrls` is pure + unit-tested.
 */
type Rendition = { kind?: string; bitrateKbps?: number | null; url?: string | null; downloadable?: boolean };
type Bundle = {
  content: { blocks: any[] };
  media?: { key: string; url: string; type: string }[];
  mediaAssets?: { mediaId: string; renditions: Rendition[] }[];
};

const MEDIA_CACHE = "klms-media";
const dlKey = (eid: string) => `klms_dl_${eid}`;

/** Lowest-bitrate downloadable video rendition for an asset (smallest = friendliest offline). */
function liteRendition(asset?: { renditions: Rendition[] }): Rendition | undefined {
  if (!asset) return undefined;
  return asset.renditions
    .filter((r) => (r.kind === "VIDEO" || !r.kind) && r.url)
    .sort((a, b) => (a.bitrateKbps ?? 1e9) - (b.bitrateKbps ?? 1e9))[0];
}

/** URLs to cache for offline playback of a block's sessions (videos + captions). */
export function blockMediaUrls(bundle: Bundle, blockIndex: number): string[] {
  const block = bundle.content.blocks.find((b) => b.index === blockIndex);
  const sessions: any[] = block?.payload?.microSessions ?? [];
  const urls: string[] = [];
  for (const m of sessions) {
    const v = m.video ?? {};
    const lite = liteRendition(bundle.mediaAssets?.find((a) => a.mediaId === v.mediaId));
    const videoUrl = (lite?.downloadable !== false ? lite?.url : null) ?? (v.url && String(v.url).trim() ? v.url : null);
    if (videoUrl) urls.push(videoUrl);
    const cap = v.subtitlesUrl || bundle.media?.find((x) => x.key === `blocks[${blockIndex}].${m.id}.captions`)?.url;
    if (cap) urls.push(cap);
  }
  return [...new Set(urls)];
}

export function downloadedBlocks(eid: string): number[] {
  try { return JSON.parse(localStorage.getItem(dlKey(eid)) || "[]"); } catch { return []; }
}
export function isBlockDownloaded(eid: string, blockIndex: number): boolean {
  return downloadedBlocks(eid).includes(blockIndex);
}
function markBlockDownloaded(eid: string, blockIndex: number) {
  const s = new Set(downloadedBlocks(eid)); s.add(blockIndex);
  try { localStorage.setItem(dlKey(eid), JSON.stringify([...s])); } catch { /* quota */ }
}

/** Fetch + cache the block's media. Returns how many files were stored. */
export async function downloadBlock(
  cacheFetch: (url: string) => Promise<Response>,
  bundle: Bundle, eid: string, blockIndex: number,
): Promise<{ cached: number; total: number }> {
  const urls = blockMediaUrls(bundle, blockIndex);
  if (typeof caches === "undefined") return { cached: 0, total: urls.length };
  const cache = await caches.open(MEDIA_CACHE);
  let cached = 0;
  for (const u of urls) {
    try {
      const res = await cacheFetch(u);
      if (res.ok) { await cache.put(new URL(u, location.href).href, res.clone()); cached++; }
    } catch { /* skip this file; partial download still useful */ }
  }
  if (cached > 0 || urls.length === 0) markBlockDownloaded(eid, blockIndex);
  return { cached, total: urls.length };
}
