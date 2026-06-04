import { test } from "node:test";
import assert from "node:assert/strict";
import { itemMediaUrls } from "./offline";

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
      { index: 0, type: "ONBOARDING", payload: { triggerVideo: { url: "https://cdn/trigger.mp4" } } },
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

test("itemMediaUrls picks the lowest video rendition + caption for a micro-session", () => {
  const urls = itemMediaUrls(bundle as any, 1, "1.1");
  assert.ok(urls.includes("/240"), "lowest-bitrate rendition for m1");
  assert.ok(!urls.includes("/720"), "not the high-bitrate one");
  assert.ok(urls.includes("https://cdn/1.1.vtt"), "session 1.1 captions");
});

test("itemMediaUrls handles a raw-url session and a caption-only-from-bundle session", () => {
  assert.deepEqual(itemMediaUrls(bundle as any, 1, "1.2"), ["https://cdn/1.2.mp4"]);
  assert.deepEqual(itemMediaUrls(bundle as any, 1, "1.3"), ["https://cdn/1.3.vtt"]);
});

test("itemMediaUrls resolves the onboarding trigger video", () => {
  assert.deepEqual(itemMediaUrls(bundle as any, 0, "onboarding"), ["https://cdn/trigger.mp4"]);
});

test("itemMediaUrls is empty for a light-only element or unknown key", () => {
  assert.deepEqual(itemMediaUrls(bundle as any, 1, "diagnostic"), []);
  assert.deepEqual(itemMediaUrls({ content: { blocks: [] } } as any, 9, "x"), []);
});
