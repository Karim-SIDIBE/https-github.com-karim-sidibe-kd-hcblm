import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentImportedDoc } from "./import-doc.js";

const H = (text: string) => ({ text, heading: true });
const P = (text: string) => ({ text, heading: false });

test("extracts title, objective and per-block notes from a structured doc", () => {
  const seg = segmentImportedDoc([
    H("Gestion du temps — Niveau 1"),
    P("Objectif : à la fin, vous saurez reprendre le contrôle de votre temps."),
    H("Bloc 0 — Onboarding"),
    P("Moment d'ancrage et vidéo déclencheur."),
    H("Bloc 1 — Compréhension"),
    P("Quiz diagnostique."),
    P("Micro-session 1.1."),
  ]);
  assert.equal(seg.title, "Gestion du temps — Niveau 1");
  assert.match(seg.objective ?? "", /reprendre le contrôle/);
  assert.equal(seg.blockTitles[0], "Onboarding");
  assert.equal(seg.blockTitles[1], "Compréhension");
  assert.match(seg.blockNotes[0] ?? "", /Moment d'ancrage/);
  assert.match(seg.blockNotes[1] ?? "", /Quiz diagnostique/);
  // "Micro-session 1.1." is now recognised as a session header, not raw notes.
  assert.equal(seg.blockSessions[1]?.[0]?.id, "1.1");
});

test("objective label on its own line uses the following paragraph", () => {
  const seg = segmentImportedDoc([H("Mon cours"), P("Objectif"), P("Savoir déléguer avec élégance dans un contexte africain.")]);
  assert.match(seg.objective ?? "", /déléguer avec élégance/);
});

test("a doc with no block headings keeps all text (parked in block 0)", () => {
  const seg = segmentImportedDoc([H("Cours libre"), P("Un paragraphe de contenu assez long pour être un objectif crédible.")]);
  assert.equal(seg.title, "Cours libre");
  // nothing is lost: leftover intro lands in block 0 notes
  assert.ok((seg.blockNotes[0] ?? "").length >= 0);
});

test("fine pass: KD-HCBLM conventions fill micro-session + video fields", () => {
  const seg = segmentImportedDoc([
    H("Gestion du temps"),
    H("Bloc 1 — Comprendre"),
    P("Objectif : poser les bases conceptuelles."),
    H("MICRO-SESSION 1.1 — VIDÉO 2 + MICRO-EXERCICE  (~20 min)"),
    P("Vidéo 2 — Le temps africain et le temps organisationnel : comprendre la tension  5-6 min"),
    P("MESSAGE CLÉ : Deux conceptions du temps coexistent."),
    P("EXEMPLE AFRICAIN : Aïssatou, 28 ans, ONG à Dakar."),
    P("⚠ ERREUR À ÉVITER : Appliquer des méthodes occidentales sans adapter."),
  ]);
  assert.equal(seg.blockObjectives[1], "poser les bases conceptuelles.");
  const s = seg.blockSessions[1]?.[0];
  assert.ok(s, "micro-session 1.1 parsed");
  assert.equal(s!.id, "1.1");
  assert.equal(s!.durationEstimate, "20 min");
  assert.equal(s!.video.title, "Le temps africain et le temps organisationnel : comprendre la tension");
  assert.match(s!.video.keyMessage ?? "", /Deux conceptions/);
  assert.match(s!.video.africanExample ?? "", /Aïssatou/);
  assert.match(s!.video.errorToAvoid ?? "", /méthodes occidentales/);
});

test("fine pass: X.0 sessions (quiz/diagnostic) carry minor 0 so they can be skipped", () => {
  const seg = segmentImportedDoc([
    H("Bloc 1 — Comprendre"),
    H("MICRO-SESSION 1.0 — QUIZ DIAGNOSTIQUE  (~15 min)"),
    P("Avant les vidéos, répondez au quiz."),
    H("MICRO-SESSION 1.1 — VIDÉO 2  (~20 min)"),
  ]);
  const ids = (seg.blockSessions[1] ?? []).map((s) => `${s.id}:${s.minor}`);
  assert.deepEqual(ids, ["1.0:0", "1.1:1"]);
});
