import { test } from "node:test";
import assert from "node:assert/strict";
import { blockItems, flattenSessions, previousSession } from "./content";

const blocks: any[] = [
  { index: 0, type: "ONBOARDING", title: "Onboarding", payload: { triggerVideo: {} } },
  { index: 1, type: "COMPREHENSION", title: "Comprendre", payload: { microSessions: [{ id: "1.1", title: "A", summaryPoints: ["x"], video: { durationSec: 240 } }], caseStudy: { title: "Cas Nadia" } } },
  { index: 2, type: "PRACTICE", title: "Pratiquer", payload: { microSessions: [{ id: "2.1", title: "B", summaryPoints: ["y"] }], guidedScenarios: [{}], interBlockQuiz: { questions: [] }, fieldApplication: {} } },
  { index: 3, type: "ANCHORING", title: "Ancrer", payload: { microSessions: [{ id: "3.1", title: "C" }], finalQuiz: { passThreshold: 70 } } },
];

test("COMPREHENSION leads with the diagnostic, then sessions, then case", () => {
  const items = blockItems(blocks[1]!);
  assert.deepEqual(items.map((i) => i.kind), ["diagnostic", "session", "case"]);
});

test("PRACTICE ends with the field application; includes interblock quiz", () => {
  const kinds = blockItems(blocks[2]!).map((i) => i.kind);
  assert.deepEqual(kinds, ["session", "scenarios", "interblock", "field"]);
});

test("ANCHORING ends with the final quiz", () => {
  assert.deepEqual(blockItems(blocks[3]!).map((i) => i.kind), ["session", "self", "plan", "final"]);
});

test("previousSession returns the prior micro-session across blocks", () => {
  assert.equal(flattenSessions(blocks).length, 3);
  assert.equal(previousSession(blocks, 1, "1.1"), null); // first session
  assert.equal(previousSession(blocks, 2, "2.1")!.id, "1.1");
  assert.equal(previousSession(blocks, 3, "3.1")!.id, "2.1");
});
