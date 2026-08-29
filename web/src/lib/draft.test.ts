import { test } from "node:test";
import assert from "node:assert/strict";
import { clearDraft, loadDraft, preloadDrafts, saveDraft } from "./draft";

// Sous node il n'y a pas d'IndexedDB : le module dégrade en brouillon mémoire
// (même comportement qu'une navigation privée stricte) — jamais bloquant.

test("preloadDrafts : sans IndexedDB, ne lève pas et laisse le module utilisable", async () => {
  await preloadDrafts();
  assert.equal(loadDraft("inexistant"), null);
});

test("aller-retour save → load, clé par inscription + item", () => {
  saveDraft("ex:e1:3:3.1", { text: "mon rituel du matin" });
  assert.deepEqual(loadDraft("ex:e1:3:3.1"), { text: "mon rituel du matin" });
  assert.equal(loadDraft("ex:e1:3:autre"), null);
  assert.equal(loadDraft(null), null);
});

test("clearDraft : purge la clé (soumission réussie)", () => {
  saveDraft("dl:e1:2:field", { fields: { a: "b" } });
  clearDraft("dl:e1:2:field");
  assert.equal(loadDraft("dl:e1:2:field"), null);
  clearDraft(null); // no-op sans clé
  clearDraft("jamais-stocké"); // idempotent
});

test("les brouillons sont indépendants par clé", () => {
  saveDraft("pj:e1", { s1: "section un" });
  saveDraft("pj:e2", { s1: "autre inscription" });
  assert.deepEqual(loadDraft("pj:e1"), { s1: "section un" });
  assert.deepEqual(loadDraft("pj:e2"), { s1: "autre inscription" });
});
