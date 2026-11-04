import { test } from "node:test";
import assert from "node:assert/strict";
import { applySas, stripMarkdown, type ClaudeRequest } from "./client.js";
import { buildFormativeRequest } from "./feedback.js";
import { buildAnthropicRequest } from "./nudge.js";
import { aiRuntimeEnabled, setAiRuntimeEnabled } from "../ai-switch.js";

test("applySas : la requête sortante ne contient plus ni PII structurée ni piiKnown", () => {
  const req: ClaudeRequest = {
    model: "m", max_tokens: 100,
    system: [{ type: "text", text: "Aide Aya Koné (aya.kone@exemple-demo.ci)." }],
    messages: [{ role: "user", content: "Mon numéro : +225 07 08 09 10 11. Mon Moment d'Ancrage…" }],
    piiKnown: ["Aya Koné"],
  };
  const { outbound, reinject } = applySas(req);
  const sent = JSON.stringify(outbound);
  assert.doesNotMatch(sent, /Aya Koné|aya\.kone@|\+225/);
  assert.doesNotMatch(sent, /piiKnown/);           // champ interne, jamais envoyé à l'API
  assert.match(sent, /\[\[nom-1\]\]/);
  // La restitution rend le texte naturel à l'apprenant.
  assert.equal(reinject("Bonjour [[nom-1]], écrivez à [[courriel-1]]."), "Bonjour Aya Koné, écrivez à aya.kone@exemple-demo.ci.");
});

test("la requête de relance déclare le nom de l'apprenant en piiKnown", () => {
  const req = buildAnthropicRequest("J3", { learnerName: "Aya Koné", momentAncrage: "Ma situation.", isEnterprise: false, resume: null, blockDurationEstimate: "" });
  assert.deepEqual(req.piiKnown, ["Aya Koné"]);
  const { outbound } = applySas(req);
  assert.doesNotMatch(JSON.stringify(outbound), /Aya Koné/);
});

test("interrupteur global : coupé, aiAvailable() est faux même avec une clé", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-test";
  const { aiAvailable } = await import("./client.js");
  assert.equal(aiRuntimeEnabled(), true);          // défaut : activé
  setAiRuntimeEnabled(false);
  try {
    assert.equal(aiAvailable(), false);
  } finally {
    setAiRuntimeEnabled(true);
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test("stripMarkdown removes headings, bold, italics and rules but keeps text", () => {
  const raw = [
    "# Retour formatif — Cartographie",
    "",
    "## 🟢 **Trois points forts**",
    "1. **Vous quantifiez l'écart** réel-cible avec *clarté*.",
    "---",
    "Un calcul 2 * 3 reste intact.",
  ].join("\n");
  const out = stripMarkdown(raw);
  assert.ok(!out.includes("#"));
  assert.ok(!out.includes("**"));
  assert.ok(!/^---$/m.test(out));
  assert.ok(out.includes("Retour formatif — Cartographie"));
  assert.ok(out.includes("Vous quantifiez l'écart réel-cible avec clarté."));
  assert.ok(out.includes("2 * 3"));
});

test("stripMarkdown leaves plain text untouched", () => {
  const plain = "Deux points forts.\n\n• Piste 1 : chiffrez vos objectifs.";
  assert.equal(stripMarkdown(plain), plain);
});

test("formative request keeps a wide token margin and a plain-text brief", () => {
  const req = buildFormativeRequest({
    submissionText: "Ma réponse.",
    itemLabel: "Application terrain",
    competencies: [{ code: "D1.C1", label: "Prioriser" }],
  });
  // The word target shapes the text; the cap only prevents mid-sentence cuts.
  assert.ok(req.max_tokens >= 1024);
  const sys = req.system.map((s) => s.text).join(" ");
  assert.ok(/250 mots/.test(sys));
  assert.ok(/Markdown/.test(sys));
});
