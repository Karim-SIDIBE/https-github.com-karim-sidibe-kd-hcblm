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

const KEY = "klms_enrollments";

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

/** Flush all known enrolments; returns total ops synced (0 when offline). */
export async function flushAll(engine: Engine): Promise<{ synced: number; offline: boolean }> {
  let synced = 0;
  let offline = false;
  for (const id of knownEnrollments()) {
    const r = await engine.flush(id);
    if ((r as { offline?: boolean }).offline) offline = true;
    synced += r.synced ?? 0;
  }
  return { synced, offline };
}

/** Wire up the automatic triggers. Returns a stop() to remove listeners. */
export function startAutoSync(engine: Engine, onState?: (s: SyncState, synced?: number) => void, intervalMs = 60_000) {
  let running = false;
  const run = async () => {
    if (running || !navigator.onLine) return;
    running = true;
    onState?.("syncing");
    try {
      const { synced, offline } = await flushAll(engine);
      onState?.(offline ? "offline" : "idle", synced);
    } finally { running = false; }
  };

  const onOnline = () => run();
  const onVisible = () => { if (document.visibilityState === "visible") run(); };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(run, intervalMs);
  void run(); // initial catch-up

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
  };
}
