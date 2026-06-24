import { test } from "node:test";
import assert from "node:assert/strict";
import { rawReferencesAsset, assetIdFromKey } from "./media.service.js";

/**
 * Tolerant asset-reference scan — the safety net that keeps learner media
 * playable when a stored course version no longer satisfies the current Zod
 * schema (so `CourseContent.parse` would throw and the strict path bails out).
 * Without this, every learner gets 403 on every video while staff (who bypass
 * the gate) keep working — the exact "admin preview ok, learner can't play"
 * regression. These cases mirror the real touchpoints.
 */
test("rawReferencesAsset finds a trigger-video mediaId in malformed content", () => {
  const broken = { title: 123, blocks: [{ index: 0, payload: { triggerVideo: { mediaId: "asset_1" } } }] };
  assert.ok(rawReferencesAsset(broken, "asset_1"));
  assert.ok(!rawReferencesAsset(broken, "asset_other"));
});

test("rawReferencesAsset finds a micro-session video mediaId", () => {
  const broken = { blocks: [{ index: 2, payload: { microSessions: [{ video: { mediaId: "v9" } }, { video: {} }] } }] };
  assert.ok(rawReferencesAsset(broken, "v9"));
});

test("rawReferencesAsset is null-safe on garbage / missing blocks", () => {
  assert.ok(!rawReferencesAsset(null, "x"));
  assert.ok(!rawReferencesAsset({}, "x"));
  assert.ok(!rawReferencesAsset({ blocks: "nope" }, "x"));
  assert.ok(!rawReferencesAsset({ blocks: [null, { payload: null }] }, "x"));
});

test("assetIdFromKey extracts the asset id from a storage key", () => {
  assert.equal(assetIdFromKey("sources/abc123/source.mp4"), "abc123");
  assert.equal(assetIdFromKey("renditions/xyz/480p.mp4"), "xyz");
  assert.equal(assetIdFromKey("single"), null);
});
