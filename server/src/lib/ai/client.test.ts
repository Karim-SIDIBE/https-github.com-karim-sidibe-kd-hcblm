import { test } from "node:test";
import assert from "node:assert/strict";
import { stripMarkdown } from "./client.js";
import { buildFormativeRequest } from "./feedback.js";

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
