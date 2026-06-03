import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRendition, resolveSource, type Rendition } from "./media";

const ladder: Rendition[] = [
  { label: "240p", bitrateKbps: 200, url: "/240" },
  { label: "480p", bitrateKbps: 600, url: "/480" },
  { label: "720p", bitrateKbps: 1500, url: "/720" },
];

test("Save-Data and 2G pick the lowest rendition (200 kbps floor)", () => {
  assert.equal(pickRendition(ladder, { saveData: true })!.label, "240p");
  assert.equal(pickRendition(ladder, { effectiveType: "2g" })!.label, "240p");
  assert.equal(pickRendition(ladder, { effectiveType: "slow-2g" })!.label, "240p");
});

test("3G picks low-mid; 4G/unknown picks best", () => {
  assert.equal(pickRendition(ladder, { effectiveType: "3g" })!.label, "480p");
  assert.equal(pickRendition(ladder, { effectiveType: "4g" })!.label, "720p");
  assert.equal(pickRendition(ladder, {})!.label, "720p");
});

test("empty ladder → null", () => {
  assert.equal(pickRendition([], {}), null);
});

test("resolveSource prefers manifest, falls back to offline ladder then raw url", () => {
  const video = { url: "https://cdn/raw.mp4", subtitlesUrl: "https://cdn/fr.vtt" };
  const online = resolveSource(video, { renditions: ladder, captions: [{ label: "fr", url: "/cap" }] }, null, { effectiveType: "2g" });
  assert.equal(online.url, "/240");
  assert.equal(online.captionsUrl, "/cap");

  const offline = resolveSource(video, null, ladder, { effectiveType: "4g" });
  assert.equal(offline.url, "/720");
  assert.equal(offline.captionsUrl, "https://cdn/fr.vtt"); // content subtitles

  const rawOnly = resolveSource(video, null, null, {});
  assert.equal(rawOnly.url, "https://cdn/raw.mp4");

  const nothing = resolveSource({ url: "" }, null, null, {});
  assert.equal(nothing.url, null);
});
