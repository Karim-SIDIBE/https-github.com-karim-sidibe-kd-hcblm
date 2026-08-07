/**
 * media-bindings.ts — preserve the video ↔ MediaAsset links across content patches.
 *
 * A course video element carries admin-configured playback fields (`mediaId`,
 * `url`, `durationSec`, `subtitlesUrl`) set in the authoring UI by linking an
 * uploaded MediaAsset. These live ONLY in the course `content` JSON — the code
 * fixture (n1-full.ts) does not know them (its videos have `url: ""` and no
 * `mediaId`). So any patch that rewrites `content` from the fixture would blank
 * the links and make every learner video unplayable ("vidéo pas disponible").
 *
 * These helpers extract the bindings from existing content (keyed by a stable
 * slot) and re-apply them onto freshly-built fixture content, so a content
 * patch keeps the videos playable. Pure — no I/O; unit-tested.
 */

/** The playback fields that are authored per video and must survive a patch. */
export type VideoBinding = {
  mediaId?: string;
  url?: string;
  durationSec?: number;
  subtitlesUrl?: string;
};

type VideoLike = { mediaId?: string; url?: string; durationSec?: number; subtitlesUrl?: string };
type BlockLike = { index?: number; type?: string; payload?: Record<string, unknown> };
type ContentLike = { blocks?: BlockLike[] };

/** Stable key for a video across content revisions: block index + slot. */
const slotKey = (blockIndex: number, slot: string) => `${blockIndex}:${slot}`;

/** Iterate every video element with its stable slot key. Covers the Bloc 0
 *  trigger video and every micro-session video across all blocks. */
function forEachVideo(content: ContentLike, fn: (key: string, video: VideoLike) => void): void {
  for (const b of content.blocks ?? []) {
    const idx = typeof b.index === "number" ? b.index : NaN;
    if (Number.isNaN(idx) || !b.payload) continue;
    const trigger = b.payload.triggerVideo as VideoLike | undefined;
    if (trigger && typeof trigger === "object") fn(slotKey(idx, "trigger"), trigger);
    const sessions = b.payload.microSessions as { id?: string; video?: VideoLike }[] | undefined;
    for (const s of sessions ?? []) {
      if (s?.video && typeof s.video === "object" && s.id) fn(slotKey(idx, s.id), s.video);
    }
  }
}

const isBound = (v: VideoLike) => Boolean(v.mediaId) || Boolean(v.url && v.url.trim());

/** Collect the non-empty playback bindings from a content document. */
export function collectMediaBindings(content: ContentLike): Map<string, VideoBinding> {
  const out = new Map<string, VideoBinding>();
  forEachVideo(content, (key, v) => {
    if (!isBound(v)) return;
    out.set(key, {
      ...(v.mediaId ? { mediaId: v.mediaId } : {}),
      ...(v.url && v.url.trim() ? { url: v.url } : {}),
      ...(typeof v.durationSec === "number" ? { durationSec: v.durationSec } : {}),
      ...(v.subtitlesUrl ? { subtitlesUrl: v.subtitlesUrl } : {}),
    });
  });
  return out;
}

/** Apply saved bindings onto (fresh) content, in place. Only fills a slot whose
 *  new video has no source of its own, so authored fixture URLs are never
 *  overwritten. Returns how many slots were (re)bound. */
export function applyMediaBindings(content: ContentLike, bindings: Map<string, VideoBinding>): number {
  let applied = 0;
  forEachVideo(content, (key, v) => {
    if (isBound(v)) return; // the fixture already provides a source — keep it
    const b = bindings.get(key);
    if (!b) return;
    if (b.mediaId) v.mediaId = b.mediaId;
    if (b.url) v.url = b.url;
    if (b.durationSec != null && !v.durationSec) v.durationSec = b.durationSec;
    if (b.subtitlesUrl && !v.subtitlesUrl) v.subtitlesUrl = b.subtitlesUrl;
    applied++;
  });
  return applied;
}

/** Merge several binding maps, newest-first precedence (first wins per slot). */
export function mergeBindings(maps: Map<string, VideoBinding>[]): Map<string, VideoBinding> {
  const out = new Map<string, VideoBinding>();
  for (const m of maps) for (const [k, v] of m) if (!out.has(k)) out.set(k, v);
  return out;
}

/** Slots in `content` that still have no playable source (for reporting). */
export function unboundSlots(content: ContentLike): string[] {
  const empty: string[] = [];
  forEachVideo(content, (key, v) => { if (!isBound(v)) empty.push(key); });
  return empty;
}
