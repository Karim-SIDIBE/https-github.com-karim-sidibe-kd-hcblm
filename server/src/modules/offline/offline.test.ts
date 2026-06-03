import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaManifest } from "./offline.service.js";
import { buildScaffold } from "../../lib/ai/authoring.js";

test("media manifest extracts videos + captions, skipping empty URLs", () => {
  const content: any = buildScaffold({ domainCode: "D4", domainLabel: "X", level: 1 });
  // canonical scaffolds use placeholder (empty) URLs → no assets
  assert.equal(mediaManifest(content).length, 0);

  // populate a couple of media URLs
  content.blocks[0].payload.triggerVideo.url = "https://cdn.example/v0.mp4";
  content.blocks[0].payload.triggerVideo.subtitlesUrl = "https://cdn.example/v0.vtt";
  content.blocks[1].payload.microSessions[0].video.url = "https://cdn.example/v11.mp4";

  const assets = mediaManifest(content);
  assert.equal(assets.length, 3);
  assert.ok(assets.some((a) => a.type === "video" && a.url.endsWith("v0.mp4")));
  assert.ok(assets.some((a) => a.type === "captions" && a.url.endsWith("v0.vtt")));
  assert.ok(assets.every((a) => a.key && a.url));
});
