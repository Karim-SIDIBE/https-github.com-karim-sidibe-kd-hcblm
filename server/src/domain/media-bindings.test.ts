import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMediaBindings, collectMediaBindings, mergeBindings, unboundSlots } from "./media-bindings.js";

const withBindings = () => ({
  blocks: [
    { index: 0, type: "ONBOARDING", payload: { triggerVideo: { mediaId: "asset-trig", url: "", durationSec: 600 } } },
    { index: 1, type: "COMPREHENSION", payload: { microSessions: [
      { id: "1.1", video: { mediaId: "asset-11", url: "", durationSec: 300, subtitlesUrl: "https://s/1.1.vtt" } },
      { id: "1.2", video: { mediaId: "", url: "https://cdn/1.2.mp4" } },
    ] } },
  ],
});
const freshFixture = () => ({
  blocks: [
    { index: 0, type: "ONBOARDING", payload: { triggerVideo: { url: "", durationSec: 600 } } },
    { index: 1, type: "COMPREHENSION", payload: { microSessions: [
      { id: "1.1", video: { url: "", durationSec: 300 } },
      { id: "1.2", video: { url: "" } },
    ] } },
  ],
});

test("collect captures every bound video by stable slot", () => {
  const b = collectMediaBindings(withBindings());
  assert.equal(b.get("0:trigger")?.mediaId, "asset-trig");
  assert.equal(b.get("1:1.1")?.mediaId, "asset-11");
  assert.equal(b.get("1:1.1")?.subtitlesUrl, "https://s/1.1.vtt");
  assert.equal(b.get("1:1.2")?.url, "https://cdn/1.2.mp4");
  assert.equal(b.size, 3);
});

test("apply restores bindings onto fresh fixture content", () => {
  const fresh = freshFixture();
  const applied = applyMediaBindings(fresh, collectMediaBindings(withBindings()));
  assert.equal(applied, 3);
  assert.equal((fresh.blocks[0].payload.triggerVideo as any).mediaId, "asset-trig");
  assert.equal((fresh.blocks[1].payload.microSessions as any)[0].video.mediaId, "asset-11");
  assert.equal((fresh.blocks[1].payload.microSessions as any)[0].video.subtitlesUrl, "https://s/1.1.vtt");
  assert.equal((fresh.blocks[1].payload.microSessions as any)[1].video.url, "https://cdn/1.2.mp4");
  assert.equal(unboundSlots(fresh).length, 0);
});

test("apply never overwrites a fixture that already carries a source", () => {
  const fresh = freshFixture();
  (fresh.blocks[0].payload.triggerVideo as any).url = "https://authored/trigger.mp4";
  applyMediaBindings(fresh, collectMediaBindings(withBindings()));
  // authored url kept, stale binding not applied
  assert.equal((fresh.blocks[0].payload.triggerVideo as any).url, "https://authored/trigger.mp4");
  assert.equal((fresh.blocks[0].payload.triggerVideo as any).mediaId, undefined);
});

test("merge is newest-first per slot", () => {
  const newer = new Map([["1:1.1", { mediaId: "new" }]]);
  const older = new Map([["1:1.1", { mediaId: "old" }], ["0:trigger", { mediaId: "t" }]]);
  const m = mergeBindings([newer, older]);
  assert.equal(m.get("1:1.1")?.mediaId, "new");
  assert.equal(m.get("0:trigger")?.mediaId, "t");
});

test("unboundSlots lists only sourceless videos", () => {
  assert.deepEqual(unboundSlots(freshFixture()).sort(), ["0:trigger", "1:1.1", "1:1.2"]);
  assert.deepEqual(unboundSlots(withBindings()), []);
});
