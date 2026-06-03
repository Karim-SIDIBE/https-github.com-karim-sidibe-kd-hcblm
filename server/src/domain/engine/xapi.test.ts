import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStatement, secondsToIsoDuration, activityId, quizResult, XAPI_EXT } from "./xapi.js";

const actor = { name: "Awa Diop", userId: "u1" };

test("secondsToIsoDuration emits whole-second ISO 8601", () => {
  assert.equal(secondsToIsoDuration(0), "PT0S");
  assert.equal(secondsToIsoDuration(95), "PT95S");
  assert.equal(secondsToIsoDuration(12.4), "PT12S"); // rounds
});

test("per-question (answered) statement carries all AC#11 fields", () => {
  const objectId = activityId("gestion-temps-n1", ["blocks/1", "items/diagnostic", "questions/q3"]);
  const stmt = buildStatement({
    actor, verb: "answered", objectId, objectName: "Question q3", enrollmentId: "e1",
    result: {
      response: "B", success: false, duration: secondsToIsoDuration(18),
      extensions: { [XAPI_EXT.correctResponse]: "C", [XAPI_EXT.feedbackViewed]: true, [XAPI_EXT.timeOnTaskSeconds]: 18 },
    },
    contextExtensions: { [XAPI_EXT.block]: 1, [XAPI_EXT.session]: "diagnostic" },
  });
  assert.equal(stmt.verb.id, "http://adlnet.gov/expapi/verbs/answered");
  assert.match(stmt.object.id, /questions\/q3$/); // question ID
  assert.equal(stmt.result?.response, "B"); // selected option
  assert.equal(stmt.result?.success, false); // correctness
  assert.equal(stmt.result?.duration, "PT18S"); // time-on-question
  assert.equal(stmt.result?.extensions?.[XAPI_EXT.correctResponse], "C"); // correct option
  assert.equal(stmt.result?.extensions?.[XAPI_EXT.feedbackViewed], true); // feedback viewed
  // enrollment extension is always present alongside the custom ones
  assert.equal(stmt.context.extensions[XAPI_EXT.enrollment], "e1");
  assert.equal(stmt.context.extensions[XAPI_EXT.block], 1);
});

test("video-progress (progressed) statement carries position + fraction", () => {
  const stmt = buildStatement({
    actor, verb: "progressed", objectId: activityId("c", ["blocks/1", "items/1.2", "video"]),
    objectName: "Vidéo 1.2", enrollmentId: "e1",
    result: { extensions: { [XAPI_EXT.videoTime]: 240, [XAPI_EXT.videoLength]: 480, [XAPI_EXT.videoProgress]: 0.5 } },
  });
  assert.equal(stmt.verb.id, "http://adlnet.gov/expapi/verbs/progressed");
  assert.equal(stmt.result?.extensions?.[XAPI_EXT.videoTime], 240); // position in seconds
  assert.equal(stmt.result?.extensions?.[XAPI_EXT.videoProgress], 0.5); // fraction viewed
});

test("quizResult scales percentage to 0..1", () => {
  const r = quizResult(80, 8, 10, 70);
  assert.equal(r.score?.scaled, 0.8);
  assert.equal(r.success, true);
});
