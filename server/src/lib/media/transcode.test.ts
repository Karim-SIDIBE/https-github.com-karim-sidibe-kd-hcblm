import { test } from "node:test";
import assert from "node:assert/strict";
import { processVideo, ffmpegAvailable, LADDER } from "./transcode.js";

test("the rendition ladder offers a low-bitrate downloadable + audio-only variant", () => {
  const lite = LADDER.find((l) => l.label === "240p-lite");
  assert.ok(lite && lite.downloadable && lite.bitrateKbps <= 400);
  assert.ok(LADDER.some((l) => l.kind === "AUDIO" && l.downloadable));
});

test("without ffmpeg, source stays playable and the ladder is recorded as planned", async (t) => {
  if (ffmpegAvailable()) return t.skip("ffmpeg present — passthrough path not exercised");
  const { renditions } = await processVideo({ id: "asset_x", mime: "video/mp4", storageKey: "sources/asset_x/source.mp4", sizeBytes: 1000 });
  const source = renditions.find((r) => r.label === "source");
  assert.ok(source?.available && source.downloadable);
  // ladder entries present but flagged not-yet-available
  assert.ok(renditions.filter((r) => r.label !== "source").every((r) => r.available === false));
  assert.ok(renditions.some((r) => r.label === "240p-lite"));
});
