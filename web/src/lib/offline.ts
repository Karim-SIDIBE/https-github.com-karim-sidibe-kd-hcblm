/**
 * offline.ts — per-element offline availability (§9 / AC#12).
 *
 * The unit the learner makes available offline is a SINGLE block element (a
 * micro-session — with or without video — a quiz, an étude de cas, etc.), never a
 * whole block. Making an element available:
 *   1. caches its media (lowest-bitrate video + captions, if any) into the
 *      `klms-media` Cache Storage bucket (served CacheFirst, range-aware), and
 *   2. records it in a per-enrolment registry with a 7-DAY expiry.
 *
 * After 7 days, or once the element is completed online (or as soon as an
 * offline completion syncs), the element is PURGED: its media is evicted from the
 * cache and the registry entry removed, so it must be made available again.
 *
 * Note: media is cached into the browser's internal Cache Storage (served back to
 * <video>) — it is never written to the device as a downloadable file. The term
 * surfaced in the UI is "Rendre disponible hors ligne", never "télécharger".
 *
 * Pure helpers (itemMediaUrls) are unit-tested.
 */
type Rendition = { label?: string; kind?: string; bitrateKbps?: number | null; url?: string | null; downloadable?: boolean };
type Bundle = {
  content: { blocks: any[] };
  media?: { key: string; url: string; type: string }[];
  mediaAssets?: { mediaId: string; renditions: Rendition[] }[];
};

const MEDIA_CACHE = "klms-media";
const TTL_DAYS = 7;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const regKey = (eid: string) => `klms_off_${eid}`;
const entryKey = (blockIndex: number, itemKey: string) => `b${blockIndex}:${itemKey}`;

/** Lowest-bitrate downloadable video rendition for an asset (smallest = friendliest offline). */
function liteRendition(asset?: { renditions: Rendition[] }): Rendition | undefined {
  if (!asset) return undefined;
  return asset.renditions
    .filter((r) => (r.kind === "VIDEO" || !r.kind) && r.url)
    .sort((a, b) => (a.bitrateKbps ?? 1e9) - (b.bitrateKbps ?? 1e9))[0];
}

/** Rendition to DOWNLOAD for offline use. Default: the lite (240p) rendition —
 *  frugal on storage and 3G. If the learner explicitly forced a quality in the
 *  player (sticky "klms_video_quality", e.g. "480p"), that choice is honoured
 *  so offline viewing matches what they watch online. */
function downloadRendition(asset?: { renditions: Rendition[] }): Rendition | undefined {
  if (!asset) return undefined;
  let pref = "auto";
  try { pref = localStorage.getItem("klms_video_quality") || "auto"; } catch { /* */ }
  if (pref !== "auto") {
    const chosen = asset.renditions.find((r) => (r.kind === "VIDEO" || !r.kind) && r.url && r.label === pref);
    if (chosen) return chosen;
  }
  return liteRendition(asset);
}

/** Media URLs for one video object (lowest rendition + caption track). */
function videoUrls(bundle: Bundle, blockIndex: number, sessionId: string, video: { mediaId?: string; url?: string; subtitlesUrl?: string }): string[] {
  const urls: string[] = [];
  const lite = downloadRendition(bundle.mediaAssets?.find((a) => a.mediaId === video.mediaId));
  const v = lite?.url ?? (video.url && String(video.url).trim() ? video.url : null);
  if (v) urls.push(v);
  const cap = video.subtitlesUrl || bundle.media?.find((x) => x.key === `blocks[${blockIndex}].${sessionId}.captions`)?.url;
  if (cap) urls.push(cap);
  return [...new Set(urls)];
}

/** URLs to cache for offline use of ONE element. Light-only elements return []. */
export function itemMediaUrls(bundle: Bundle, blockIndex: number, itemKey: string): string[] {
  const block = bundle.content.blocks.find((b) => b.index === blockIndex);
  if (!block) return [];
  if (block.type === "ONBOARDING" && (itemKey === "onboarding" || itemKey === "trigger")) {
    return videoUrls(bundle, blockIndex, "trigger", block.payload?.triggerVideo ?? {});
  }
  const session = (block.payload?.microSessions ?? []).find((s: any) => s.id === itemKey);
  if (session) return videoUrls(bundle, blockIndex, session.id, session.video ?? {});
  return []; // light-only element (quiz, case study, field application, journal, plan…)
}

// --- registry ---------------------------------------------------------------

type Entry = { at: number; exp: number; urls: string[] };
type Registry = Record<string, Entry>;

function readReg(eid: string): Registry {
  try { return JSON.parse(localStorage.getItem(regKey(eid)) || "{}"); } catch { return {}; }
}
function writeReg(eid: string, reg: Registry) {
  try { localStorage.setItem(regKey(eid), JSON.stringify(reg)); } catch { /* quota */ }
}

async function deleteFromCache(urls: string[]) {
  if (typeof caches === "undefined" || urls.length === 0) return;
  const cache = await caches.open(MEDIA_CACHE);
  for (const u of urls) { try { await cache.delete(new URL(u, location.href).href); } catch { /* */ } }
}

export type Availability = { available: boolean; expiresAt: number | null; daysLeft: number };

/** URLs actually cached for one element (empty when not made available). Lets
 *  the player pick, OFFLINE, the exact rendition that lives in the cache. */
export function cachedUrlsOf(eid: string, blockIndex: number, itemKey: string): string[] {
  const e = readReg(eid)[entryKey(blockIndex, itemKey)];
  return e && e.exp > Date.now() ? e.urls : [];
}

/** Current offline availability of one element (expired entries read as unavailable). */
export function availabilityOf(eid: string, blockIndex: number, itemKey: string): Availability {
  const e = readReg(eid)[entryKey(blockIndex, itemKey)];
  if (!e) return { available: false, expiresAt: null, daysLeft: 0 };
  const now = Date.now();
  if (e.exp <= now) return { available: false, expiresAt: e.exp, daysLeft: 0 };
  return { available: true, expiresAt: e.exp, daysLeft: Math.max(1, Math.ceil((e.exp - now) / DAY_MS)) };
}

/** Make ONE element available offline (cache its media + start the 7-day timer). */
export async function makeAvailable(
  cacheFetch: (url: string) => Promise<Response>,
  bundle: Bundle, eid: string, blockIndex: number, itemKey: string,
): Promise<{ cached: number; total: number }> {
  const urls = itemMediaUrls(bundle, blockIndex, itemKey);
  let cached = 0;
  if (typeof caches !== "undefined" && urls.length > 0) {
    const cache = await caches.open(MEDIA_CACHE);
    for (const u of urls) {
      try {
        const res = await cacheFetch(u);
        if (res.ok) { await cache.put(new URL(u, location.href).href, res.clone()); cached++; }
      } catch { /* skip this file; partial still useful */ }
    }
  }
  const now = Date.now();
  const reg = readReg(eid);
  reg[entryKey(blockIndex, itemKey)] = { at: now, exp: now + TTL_MS, urls };
  writeReg(eid, reg);
  return { cached, total: urls.length };
}

/** Remove ONE element's offline availability (evict media + registry entry). */
export async function removeAvailability(eid: string, blockIndex: number, itemKey: string): Promise<void> {
  const reg = readReg(eid);
  const e = reg[entryKey(blockIndex, itemKey)];
  if (!e) return;
  await deleteFromCache(e.urls);
  delete reg[entryKey(blockIndex, itemKey)];
  writeReg(eid, reg);
}

/** Purge EVERY offline element of an enrolment — used when the server reveals
 *  the enrolment was reset (its offline copies belong to the previous run). */
export async function purgeAllAvailability(eid: string): Promise<number> {
  const reg = readReg(eid);
  const keys = Object.keys(reg);
  for (const key of keys) await deleteFromCache(reg[key]!.urls);
  if (keys.length > 0) writeReg(eid, {});
  return keys.length;
}

/** Purge every element whose 7-day window has elapsed. Returns how many were purged. */
export async function purgeExpired(eid: string): Promise<number> {
  const reg = readReg(eid);
  const now = Date.now();
  let n = 0; let changed = false;
  for (const key of Object.keys(reg)) {
    if (reg[key]!.exp <= now) { await deleteFromCache(reg[key]!.urls); delete reg[key]; changed = true; n++; }
  }
  if (changed) writeReg(eid, reg);
  return n;
}

/**
 * Purge elements that the server now considers completed. Called with the
 * per-block list of completed item keys from the latest progress snapshot — so a
 * completion done online purges immediately, and one done offline purges as soon
 * as it syncs (progress then reflects it). Returns how many were purged.
 */
export async function purgeCompleted(eid: string, completedByBlock: Record<number, string[]>): Promise<number> {
  const reg = readReg(eid);
  let n = 0; let changed = false;
  for (const key of Object.keys(reg)) {
    const m = /^b(\d+):(.+)$/.exec(key);
    if (!m) continue;
    const blockIndex = Number(m[1]);
    const itemKey = m[2]!;
    if ((completedByBlock[blockIndex] ?? []).includes(itemKey)) {
      await deleteFromCache(reg[key]!.urls); delete reg[key]; changed = true; n++;
    }
  }
  if (changed) writeReg(eid, reg);
  return n;
}
