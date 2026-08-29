import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTimestamp, parseTimestamp, parseVtt, serializeVtt, shiftCues } from "./vtt.js";

const SAMPLE = `WEBVTT

00:00:01.000 --> 00:00:03.500
Bonjour et bienvenue
dans ce parcours.

00:00:04.000 --> 00:00:06.000 align:center
Deuxième cue.
`;

test("parseVtt : cues, multi-lignes et réglages conservés", () => {
  const cues = parseVtt(SAMPLE);
  assert.equal(cues.length, 2);
  assert.equal(cues[0]!.start, 1);
  assert.equal(cues[0]!.end, 3.5);
  assert.equal(cues[0]!.text, "Bonjour et bienvenue\ndans ce parcours.");
  assert.equal(cues[1]!.settings, "align:center");
});

test("parseVtt : horodatages SRT (virgule) et mm:ss acceptés, blocs sans --> ignorés", () => {
  const cues = parseVtt("WEBVTT\n\nNOTE test\n\n01:02,250 --> 01:05,000\nTexte");
  assert.equal(cues.length, 1);
  assert.equal(cues[0]!.start, 62.25);
});

test("aller-retour parse → serialize fidèle (format canonique)", () => {
  const round = parseVtt(serializeVtt(parseVtt(SAMPLE)));
  assert.deepEqual(round, parseVtt(SAMPLE));
  assert.ok(serializeVtt(parseVtt(SAMPLE)).startsWith("WEBVTT\n\n00:00:01.000 --> 00:00:03.500"));
});

test("shiftCues : décalage positif préserve les durées", () => {
  const [a, b] = shiftCues(parseVtt(SAMPLE), 1.5);
  assert.equal(a!.start, 2.5);
  assert.equal(a!.end, 5);
  assert.equal(b!.start, 5.5);
});

test("shiftCues : décalage négatif tronqué à 0, jamais d'horodatage négatif", () => {
  const [a] = shiftCues(parseVtt(SAMPLE), -2);
  assert.equal(a!.start, 0);
  assert.equal(a!.end, 1.5);
  assert.ok(formatTimestamp(a!.start) === "00:00:00.000");
});

test("serializeVtt : une cue vidée de son texte est retirée", () => {
  const cues = parseVtt(SAMPLE);
  cues[1]!.text = "  ";
  assert.equal(parseVtt(serializeVtt(cues)).length, 1);
});

test("parseTimestamp : heures optionnelles et invalides", () => {
  assert.equal(parseTimestamp("01:02:03.004"), 3723.004);
  assert.equal(parseTimestamp("n'importe quoi"), null);
});
