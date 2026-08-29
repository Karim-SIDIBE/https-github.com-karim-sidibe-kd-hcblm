import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { clearDraft, loadDraft } from "./draft";

// localStorage factice (node:test tourne hors navigateur).
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
};

beforeEach(() => mem.clear());

test("loadDraft : restitue la valeur stockée, null sinon", () => {
  mem.set("kd:draft:ex:e1:3:3.1", JSON.stringify({ v: { text: "mon rituel" }, at: 1 }));
  assert.deepEqual(loadDraft("ex:e1:3:3.1"), { text: "mon rituel" });
  assert.equal(loadDraft("ex:e1:3:autre"), null);
  assert.equal(loadDraft(null), null);
});

test("loadDraft : contenu corrompu → null, jamais d'exception", () => {
  mem.set("kd:draft:x", "{pas du json");
  assert.equal(loadDraft("x"), null);
});

test("clearDraft : purge la clé (soumission réussie)", () => {
  mem.set("kd:draft:x", JSON.stringify({ v: "brouillon" }));
  clearDraft("x");
  assert.equal(loadDraft("x"), null);
  clearDraft(null); // no-op sans clé
});

test("loadDraft : sans localStorage (navigation privée stricte) → null", () => {
  const saved = (globalThis as any).localStorage;
  delete (globalThis as any).localStorage;
  try { assert.equal(loadDraft("x"), null); } finally { (globalThis as any).localStorage = saved; }
});
