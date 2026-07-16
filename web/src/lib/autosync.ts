/**
 * autosync.ts — automatic, no-tap synchronisation (§9 / AC#12).
 *
 * Queued learner actions are flushed automatically whenever the app can reach
 * the network: on reconnect (`online`), when the tab returns to the foreground
 * (`visibilitychange`), and on a slow heartbeat interval while online. This
 * covers every realistic interruption (network drop, app backgrounded, device
 * switch) without the learner pressing anything.
 *
 * Note: background sync while the app is fully closed needs a custom service
 * worker `sync` handler — that lands with the offline-video work (Phase 6).
 */
import type { Engine } from "./sync";
import { setCachedProgress, type ProgressSnapshot } from "./cache";

const KEY = "klms_enrollments";
const PROGRESS_EVENT = "klms:progress";

/** Broadcast a fresh progress snapshot so open screens re-render live —
 *  no manual page refresh needed after a background sync or a remote pull. */
export function emitProgress(eid: string, progress: ProgressSnapshot) {
  setCachedProgress(eid, progress);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: { eid, progress } }));
  }
}

/** Subscribe a screen to live progress updates for one enrolment. */
export function onProgress(eid: string, cb: (p: ProgressSnapshot) => void): () => void {
  const handler = (e: Event) => {
    const d = (e as CustomEvent).detail as { eid: string; progress: ProgressSnapshot };
    if (d?.eid === eid && d.progress) cb(d.progress);
  };
  window.addEventListener(PROGRESS_EVENT, handler);
  return () => window.removeEventListener(PROGRESS_EVENT, handler);
}

/** Pure: dedupe-append an id to a known-enrolment list (most-recent first). */
export function addEnrollment(list: string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)];
}

export function knownEnrollments(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function rememberEnrollment(id: string) {
  localStorage.setItem(KEY, JSON.stringify(addEnrollment(knownEnrollments(), id)));
}

export type SyncState = "idle" | "syncing" | "offline";

/** Flush all known enrolments; returns total ops synced (0 when offline).
 *  Progress returned by the sync is applied + broadcast so the UI updates. */
export async function flushAll(engine: Engine): Promise<{ synced: number; offline: boolean }> {
  let synced = 0;
  let offline = false;
  for (const id of knownEnrollments()) {
    const r = await engine.flush(id);
    if ((r as { offline?: boolean }).offline) offline = true;
    synced += r.synced ?? 0;
    const progress = (r as { progress?: ProgressSnapshot }).progress;
    if (progress) emitProgress(id, progress);
  }
  return { synced, offline };
}

/** Optional remote pull — fetches the server's progress for one enrolment
 *  (covers completions made on ANOTHER device: nothing to flush locally). */
export type ProgressPull = (eid: string) => Promise<ProgressSnapshot | null>;

/** Wire up the automatic triggers. Returns a stop() to remove listeners. */
export function startAutoSync(engine: Engine, onState?: (s: SyncState, synced?: number) => void, intervalMs = 60_000, pull?: ProgressPull) {
  let running = false;
  let lastPull = 0;
  const PULL_EVERY_MS = 5 * 60_000; // remote pull heartbeat while the tab stays open

  const run = async (wake = false) => {
    if (running || !navigator.onLine) return;
    running = true;
    onState?.("syncing");
    try {
      const { synced, offline } = await flushAll(engine);
      // Pull remote progress on wake-ups (reconnect / tab focus / start) and on
      // a slow heartbeat — this is what keeps a second device in step without
      // a manual refresh.
      if (pull && !offline && (wake || Date.now() - lastPull > PULL_EVERY_MS)) {
        lastPull = Date.now();
        for (const id of knownEnrollments()) {
          try { const p = await pull(id); if (p) emitProgress(id, p); } catch { /* offline again */ }
        }
      }
      onState?.(offline ? "offline" : "idle", synced);
    } finally { running = false; }
  };

  const onOnline = () => run(true);
  const onVisible = () => { if (document.visibilityState === "visible") run(true); };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(() => run(false), intervalMs);
  void run(true); // initial catch-up

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
  };
}
