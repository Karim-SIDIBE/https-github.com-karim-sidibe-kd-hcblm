import { test } from "node:test";
import assert from "node:assert/strict";
import { joinVttCues, splitVttCues, srtToVtt, translateCues } from "./subtitles.js";

const VTT = `WEBVTT

1
00:00:00.000 --> 00:00:03.500
Bonjour et bienvenue dans cette formation.

2
00:00:03.500 --> 00:00:07.000
Aujourd'hui : la gestion du temps.
`;

test("srtToVtt : virgules d'horodatage → points, en-tête WEBVTT ajouté", () => {
  const srt = "1\n00:00:00,000 --> 00:00:03,500\nBonjour.\n\n2\n00:00:03,500 --> 00:00:07,000\nSuite.\n";
  const vtt = srtToVtt(srt);
  assert.ok(vtt.startsWith("WEBVTT\n\n"));
  assert.ok(vtt.includes("00:00:00.000 --> 00:00:03.500"));
  assert.ok(!vtt.includes(","));
  // Idempotent sur un fichier déjà VTT.
  assert.ok(srtToVtt(VTT).startsWith("WEBVTT"));
});

test("splitVttCues / joinVttCues : aller-retour sans perte, horodatages intacts", () => {
  const { preamble, cues } = splitVttCues(VTT);
  assert.equal(preamble, "WEBVTT");
  assert.equal(cues.length, 2);
  assert.ok(cues[0]!.header.includes("00:00:00.000 --> 00:00:03.500"));
  assert.equal(cues[1]!.text, "Aujourd'hui : la gestion du temps.");
  assert.equal(joinVttCues(preamble, cues).trim(), VTT.trim());
});

test("translateCues : textes traduits, horodatages et numéros préservés", async () => {
  const out = await translateCues(VTT, async (texts) => texts.map((t) => `EN:${t}`));
  assert.ok(out.includes("EN:Bonjour et bienvenue dans cette formation."));
  assert.ok(out.includes("00:00:03.500 --> 00:00:07.000"));
  const back = splitVttCues(out);
  assert.equal(back.cues.length, 2);
});

test("translateCues : mauvais nombre de segments → erreur explicite", async () => {
  await assert.rejects(() => translateCues(VTT, async () => ["seul"]), /segments/);
});
