/**
 * sync.ts — offline-first engine.
 *
 * Caches the course bundle (ETag-aware), queues learner actions with a stable
 * opId, and flushes them to /sync when connectivity allows. Applied/deduped ops
 * are dropped from the queue; failed ones stay for a later retry (matching the
 * server's idempotent, ordered replay).
 */
import type { OfflineStore } from "./store";
import type { QueuedAction, SyncResult } from "./types";

export type SyncApi = {
  getOfflineBundle(enrollmentId: string, etag?: string): Promise<{ status: number; bundle?: any }>;
  sync(enrollmentId: string, actions: QueuedAction[]): Promise<{ results: SyncResult[]; progress?: any; resume?: any; badges?: any }>;
};

const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `op-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function createEngine(store: OfflineStore, api: SyncApi) {
  return {
    /** Download + cache the bundle; a 304 keeps the cached copy. */
    async cacheBundle(enrollmentId: string) {
      const cached = await store.getBundle<{ bundleVersion?: string }>(enrollmentId);
      try {
        const res = await api.getOfflineBundle(enrollmentId, cached?.bundleVersion);
        if (res.status === 304) return cached;
        if (res.bundle) { await store.saveBundle(enrollmentId, res.bundle); return res.bundle; }
      } catch { /* offline → fall back to cache */ }
      return cached;
    },

    /** Queue an action locally (and let the caller flush). */
    async record(enrollmentId: string, type: string, payload?: Record<string, unknown>): Promise<QueuedAction> {
      const action: QueuedAction = { opId: uuid(), type, clientTs: new Date().toISOString(), payload };
      await store.enqueue(enrollmentId, action);
      return action;
    },

    /** Record an action then attempt an immediate flush (offline-safe). The flush
     *  result carries the recomputed progress/resume/badges when online. */
    async commit(enrollmentId: string, type: string, payload?: Record<string, unknown>) {
      await this.record(enrollmentId, type, payload);
      return this.flush(enrollmentId);
    },

    /** Replay queued actions; drop applied/deduped, keep failed for retry. */
    async flush(enrollmentId: string) {
      const actions = await store.pending(enrollmentId);
      if (actions.length === 0) return { synced: 0, results: [] as SyncResult[] };
      let res;
      try { res = await api.sync(enrollmentId, actions); }
      catch { return { synced: 0, offline: true, results: [] as SyncResult[] }; }
      const done = res.results.filter((r) => r.status === "applied" || r.status === "deduped").map((r) => r.opId);
      await store.remove(enrollmentId, done);
      return { synced: done.length, results: res.results, progress: res.progress, resume: res.resume, badges: res.badges };
    },

    async pendingCount(enrollmentId: string) {
      return (await store.pending(enrollmentId)).length;
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;
