import { test } from "node:test";
import assert from "node:assert/strict";
import { dueStage, buildMessage, day7AnchorsPam, daysInactive } from "./reengagement.js";

test("dueStage maps inactivity to the highest crossed stage", () => {
  assert.equal(dueStage(2), null);
  assert.equal(dueStage(3), "J3");
  assert.equal(dueStage(7), "J7");
  assert.equal(dueStage(20), "J14");
});

test("daysInactive floors to whole days", () => {
  const now = new Date("2026-01-10T00:00:00Z");
  assert.equal(daysInactive(new Date("2026-01-07T00:00:00Z"), now), 3);
});

test("the J+7 message re-injects the Moment d'Ancrage", () => {
  const pam = "je cours après les urgences";
  const { body } = buildMessage("J7", { learnerName: "Awa", momentAncrage: pam, isEnterprise: false, resume: null, blockDurationEstimate: "" });
  assert.ok(body.includes(pam));
  assert.equal(day7AnchorsPam(pam), true);
});

test("J+14 routes to the admin for enterprise enrolments", () => {
  const ent = buildMessage("J14", { learnerName: "Bintou", momentAncrage: null, isEnterprise: true, resume: null, blockDurationEstimate: "" });
  assert.equal(ent.channel, "ADMIN");
  const solo = buildMessage("J14", { learnerName: "Bintou", momentAncrage: null, isEnterprise: false, resume: null, blockDurationEstimate: "" });
  assert.equal(solo.channel, "LEARNER");
});
