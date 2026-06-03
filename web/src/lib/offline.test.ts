import { test } from "node:test";
import assert from "node:assert/strict";
import { blockMediaUrls } from "./offline";

const bundle = {
  content: {
    blocks: [
      {
        index: 1, type: "COMPREHENSION",
        payload: {
          microSessions: [
            { id: "1.1", video: { mediaId: "m1", subtitlesUrl: "https://cdn/1.1.vtt" } },
            { id: "1.2", video: { url: "https://cdn/1.2.mp4" } }, // raw url, no asset
            { id: "1.3", video: {} }, // nothing downloadable
          ],
        },
      },
    ],
  },
  media: [{ key: "blocks[1].1.3.captions", url: "https://cdn/1.3.vtt", type: "captions" }],
  mediaAssets: [
    { mediaId: "m1", renditions: [
      { kind: "VIDEO", bitrateKbps: 1500, url: "/720", downloadable: true },
      { kind: "VIDEO", bitrateKbps: 200, url: "/240", downloadable: true }, // lowest → chosen
      { kind: "CAPTIONS", url: "/cap", downloadable: true },
    ] },
  ],
};

test("blockMediaUrls picks the lowest video rendition + caption per session", () => {
  const urls = blockMediaUrls(bundle as any, 1);
  assert.ok(urls.includes("/240"), "lowest-bitrate rendition for m1");
  assert.ok(!urls.includes("/720"), "not the high-bitrate one");
  assert.ok(urls.includes("https://cdn/1.1.vtt"), "session 1.1 captions");
  assert.ok(urls.includes("https://cdn/1.2.mp4"), "raw-url video for 1.2");
  assert.ok(urls.includes("https://cdn/1.3.vtt"), "caption-from-bundle for 1.3 (no video)");
});

test("empty for a block with no media", () => {
  assert.deepEqual(blockMediaUrls({ content: { blocks: [{ index: 2, payload: {} }] } } as any, 2), []);
});
