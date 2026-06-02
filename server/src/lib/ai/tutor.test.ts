import { test } from "node:test";
import assert from "node:assert/strict";
import { isGrounded, buildTutorRequest, answer, type RetrievedChunk } from "./tutor.js";

const chunk = (text: string, score = 0.3): RetrievedChunk => ({ score, blockIndex: 1, path: "blocks[1].1.4", text });
const onTopic = [chunk("Gérer les interruptions dans les organisations africaines : signaler sans rejeter, capturer sans traiter.")];

test("grounding guard: subject terms must appear in the passages", () => {
  assert.equal(isGrounded("Comment gérer les interruptions WhatsApp ?", onTopic), true);
  assert.equal(isGrounded("Quelle est la capitale de l'Australie ?", onTopic), false); // interrogatives are stopwords
  assert.equal(isGrounded("anything", []), false);
});

test("the tutor prompt is grounded + personalized + cached", () => {
  const req = buildTutorRequest("Comment gérer les interruptions ?", onTopic, [], "je suis interrompu par WhatsApp");
  assert.equal(req.system[0].cache_control?.type, "ephemeral");
  assert.match(req.messages[0].content, /EXTRAITS DU COURS/);
  assert.match(req.messages[0].content, /WhatsApp/); // PAM personalization
  assert.match(req.messages[0].content, /interruptions/);
});

test("off-topic → guardrail answer, no hallucination", async () => {
  const r = await answer("Quelle est la capitale de l'Australie ?", onTopic, [], null);
  assert.equal(r.grounded, false);
  assert.equal(r.provider, "guardrail");
  assert.equal(r.citations.length, 0);
});

test("on-topic offline → extractive grounded answer with citations", async () => {
  const r = await answer("Comment gérer les interruptions ?", onTopic, [], null);
  assert.equal(r.grounded, true);
  assert.equal(r.provider, "extractive");
  assert.ok(r.citations.length > 0);
});
