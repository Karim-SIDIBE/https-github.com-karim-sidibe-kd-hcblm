import { test } from "node:test";
import assert from "node:assert/strict";
import { memStore } from "./store";
import { createEngine, type SyncApi } from "./sync";

const EID = "enr_1";

test("record queues an action with a stable opId + timestamp", async () => {
  const eng = createEngine(memStore(), {} as SyncApi);
  const a = await eng.record(EID, "complete_item", { blockIndex: 1, itemKey: "1.1" });
  assert.ok(a.opId && a.clientTs);
  assert.equal(await eng.pendingCount(EID), 1);
});

test("flush drops applied/deduped, keeps failed for retry", async () => {
  const store = memStore();
  const calls: any[] = [];
  const api: SyncApi = {
    async getOfflineBundle() { return { status: 200 }; },
    async sync(_e, actions) {
      calls.push(actions);
      return { results: actions.map((a, i) => ({ opId: a.opId, status: i === 0 ? "applied" : "failed" as const })) };
    },
  };
  const eng = createEngine(store, api);
  await eng.record(EID, "a", {});
  await eng.record(EID, "b", {});
  const r = await eng.flush(EID);
  assert.equal(r.synced, 1);
  assert.equal(await eng.pendingCount(EID), 1); // the failed one stays
});

test("flush while offline keeps the whole queue", async () => {
  const eng = createEngine(memStore(), { async getOfflineBundle() { return { status: 0 }; }, async sync() { throw new Error("network"); } });
  await eng.record(EID, "a", {});
  const r = await eng.flush(EID);
  assert.equal((r as any).offline, true);
  assert.equal(await eng.pendingCount(EID), 1);
});

test("cacheBundle saves on 200 and returns the cached copy on 304", async () => {
  const store = memStore();
  let etagSeen: string | undefined;
  const api: SyncApi = {
    async getOfflineBundle(_e, etag) {
      etagSeen = etag;
      return etag ? { status: 304 } : { status: 200, bundle: { bundleVersion: "v1", content: { title: "X" } } };
    },
    async sync() { return { results: [] }; },
  };
  const eng = createEngine(store, api);
  const first = await eng.cacheBundle(EID);
  assert.equal(first.bundleVersion, "v1");
  const second = await eng.cacheBundle(EID); // sends If-None-Match → 304 → cached
  assert.equal(etagSeen, "v1");
  assert.equal(second.content.title, "X");
});
