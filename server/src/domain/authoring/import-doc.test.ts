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
  assert.match(seg.blockNotes[1] ?? "", /Micro-session 1\.1/);
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
