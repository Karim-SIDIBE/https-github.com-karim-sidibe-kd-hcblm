import { test } from "node:test";
import assert from "node:assert/strict";
import { embed, cosine, embeddingsProvider } from "./embeddings.js";

test("local embedder is the default offline", () => {
  assert.equal(embeddingsProvider(), "local");
});

test("cosine of identical vectors is 1, orthogonal is 0", () => {
  assert.ok(Math.abs(cosine([1, 0], [1, 0]) - 1) < 1e-9);
  assert.equal(cosine([1, 0], [0, 1]), 0);
});

test("local embeddings rank the relevant text higher", async () => {
  const docs = [
    "déléguer une tâche à un junior et assurer le suivi",
    "couper l'électricité pendant une coupure de courant",
  ];
  const { vectors } = await embed([...docs, "comment déléguer à un junior"]);
  const [d0, d1, q] = vectors;
  assert.ok(cosine(q!, d0!) > cosine(q!, d1!));
});
