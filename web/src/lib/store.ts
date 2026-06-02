/**
 * store.ts — offline persistence (course bundle + action queue).
 *
 * `OfflineStore` is an interface so the sync engine is testable with an in-memory
 * store; the browser uses an IndexedDB-backed implementation.
 */
import type { QueuedAction } from "./types";

export interface OfflineStore {
  saveBundle(enrollmentId: string, bundle: unknown): Promise<void>;
  getBundle<T = any>(enrollmentId: string): Promise<T | null>;
  enqueue(enrollmentId: string, action: QueuedAction): Promise<void>;
  pending(enrollmentId: string): Promise<QueuedAction[]>;
  remove(enrollmentId: string, opIds: string[]): Promise<void>;
}

/** In-memory store (tests, SSR fallback). */
export function memStore(): OfflineStore {
  const bundles = new Map<string, unknown>();
  const queues = new Map<string, QueuedAction[]>();
  return {
    async saveBundle(e, b) { bundles.set(e, b); },
    async getBundle(e) { return (bundles.get(e) as any) ?? null; },
    async enqueue(e, a) { const q = queues.get(e) ?? []; q.push(a); queues.set(e, q); },
    async pending(e) { return (queues.get(e) ?? []).slice(); },
    async remove(e, ids) { queues.set(e, (queues.get(e) ?? []).filter((a) => !ids.includes(a.opId))); },
  };
}

// --- IndexedDB-backed store (browser) ---------------------------------------

function openDb(name = "klms"): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("bundles")) db.createObjectStore("bundles");
      if (!db.objectStoreNames.contains("actions")) db.createObjectStore("actions");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

export function idbStore(name = "klms"): OfflineStore {
  const db = openDb(name);
  const aKey = (e: string, opId: string) => `${e}::${opId}`;
  return {
    async saveBundle(e, b) { await tx(await db, "bundles", "readwrite", (s) => s.put(b, e)); },
    async getBundle(e) { return (await tx<any>(await db, "bundles", "readonly", (s) => s.get(e))) ?? null; },
    async enqueue(e, a) { await tx(await db, "actions", "readwrite", (s) => s.put({ e, a }, aKey(e, a.opId))); },
    async pending(e) {
      const all = await tx<{ e: string; a: QueuedAction }[]>(await db, "actions", "readonly", (s) => s.getAll());
      return all.filter((x) => x.e === e).map((x) => x.a).sort((x, y) => x.clientTs.localeCompare(y.clientTs));
    },
    async remove(e, ids) {
      const d = await db;
      await Promise.all(ids.map((opId) => tx(d, "actions", "readwrite", (s) => s.delete(aKey(e, opId)))));
    },
  };
}
