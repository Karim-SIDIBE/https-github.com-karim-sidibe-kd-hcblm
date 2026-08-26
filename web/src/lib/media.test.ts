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

  // OFFLINE: only the lightest (downloadable) rendition was cached by
  // « Rendre disponible hors ligne » — the picker must select it, whatever the
  // reported connection, or playback cache-misses.
  const offline = resolveSource(video, null, ladder, { effectiveType: "4g" });
  assert.equal(offline.url, "/240");
  assert.equal(offline.captionsUrl, "https://cdn/fr.vtt"); // content subtitles

  const rawOnly = resolveSource(video, null, null, {});
  assert.equal(rawOnly.url, "https://cdn/raw.mp4");

  const nothing = resolveSource({ url: "" }, null, null, {});
  assert.equal(nothing.url, null);
});

test("resolveSource : pistes de sous-titres multilingues (manifest, bundle hors-ligne, repli contenu)", () => {
  const video = { url: "https://cdn/raw.mp4", subtitlesUrl: "https://cdn/fr.vtt" };
  // En ligne : toutes les pistes du manifest, dans l'ordre.
  const online = resolveSource(video, { renditions: ladder, captions: [
    { label: "Français", language: "fr", url: "/fr.vtt" },
    { label: "English", language: "en", url: "/en.vtt" },
  ] }, null, {});
  assert.deepEqual(online.captionTracks.map((c) => c.language), ["fr", "en"]);
  assert.equal(online.captionsUrl, "/fr.vtt");

  // Hors-ligne : les renditions CAPTIONS du bundle deviennent les pistes —
  // et ne polluent jamais l'échelle des sources vidéo.
  const offRenditions: Rendition[] = [
    ...ladder,
    { label: "Français", url: "/off-fr.vtt", kind: "CAPTIONS", language: "fr" },
    { label: "English", url: "/off-en.vtt", kind: "CAPTIONS", language: "en" },
  ];
  const off = resolveSource(video, null, offRenditions, { effectiveType: "4g" });
  assert.deepEqual(off.captionTracks.map((c) => c.url), ["/off-fr.vtt", "/off-en.vtt"]);
  assert.notEqual(off.url, "/off-fr.vtt");

  // Sans manifest ni piste média : le subtitlesUrl du contenu = piste FR unique.
  const fallback = resolveSource(video, null, ladder, {});
  assert.deepEqual(fallback.captionTracks, [{ label: "Français", language: "fr", url: "https://cdn/fr.vtt" }]);
});
