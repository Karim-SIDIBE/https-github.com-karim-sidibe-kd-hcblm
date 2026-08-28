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

// --- transcriptionCandidates — l'ordre de repli qui sauve un média dont le
// fichier audio/source est corrompu (ex. médiathèque restaurée) -------------
import { transcriptionCandidates } from "./media.service.js";

const rend = (label: string, kind: string, opts: Partial<{ available: boolean; storageKey: string | null; bitrateKbps: number | null }> = {}) =>
  ({ label, kind, available: opts.available ?? true, storageKey: opts.storageKey === undefined ? `k/${label}` : opts.storageKey, bitrateKbps: opts.bitrateKbps ?? null });

test("transcriptionCandidates : audio → source → vidéo la plus légère", () => {
  const out = transcriptionCandidates([
    rend("720p", "VIDEO", { bitrateKbps: 2000 }),
    rend("240p-lite", "VIDEO", { bitrateKbps: 300 }),
    rend("source", "VIDEO", { bitrateKbps: null }),
    rend("audio", "AUDIO", { bitrateKbps: 64 }),
  ], "ma-video.mp4");
  assert.deepEqual(out.map((c) => c.label), ["audio", "source", "240p-lite"]);
  assert.equal(out[0]!.filename, "audio.m4a");
  assert.equal(out[1]!.filename, "ma-video.mp4");
  assert.equal(out[2]!.filename, "240p-lite.mp4");
});

test("transcriptionCandidates : rendition indisponible ou sans fichier ignorée, doublons dédupliqués", () => {
  const out = transcriptionCandidates([
    rend("audio", "AUDIO", { available: false }),          // transcodage inachevé
    rend("source", "VIDEO", { storageKey: "k/partagé" }),
    rend("480p", "VIDEO", { storageKey: "k/partagé", bitrateKbps: 800 }), // même fichier que source
    rend("720p", "VIDEO", { storageKey: null, bitrateKbps: 2000 }),       // externe
  ], null);
  assert.deepEqual(out.map((c) => c.label), ["source"]);
  assert.equal(out[0]!.filename, "source.mp4"); // pas de nom d'origine → défaut
});

test("transcriptionCandidates : média externe (aucun fichier local) → liste vide", () => {
  assert.deepEqual(transcriptionCandidates([rend("source", "VIDEO", { storageKey: null })], "x.mp4"), []);
});
