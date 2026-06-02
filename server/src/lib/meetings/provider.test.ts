import { test } from "node:test";
import assert from "node:assert/strict";
import { buildZoomMeetingBody, buildTeamsMeetingBody, configuredProvider } from "./provider.js";

const input = { topic: "Q&A live", startsAt: new Date("2026-07-01T14:00:00Z"), durationMin: 60 };

test("offline default provider is manual", () => {
  assert.equal(configuredProvider(), "manual");
});

test("Zoom meeting body is a scheduled meeting with waiting room", () => {
  const b = buildZoomMeetingBody(input);
  assert.equal(b.type, 2);
  assert.equal(b.duration, 60);
  assert.equal(b.settings.waiting_room, true);
  assert.equal(b.start_time, "2026-07-01T14:00:00.000Z");
});

test("Teams meeting body computes end = start + duration", () => {
  const b = buildTeamsMeetingBody(input);
  assert.equal(b.subject, "Q&A live");
  assert.equal(b.startDateTime, "2026-07-01T14:00:00.000Z");
  assert.equal(b.endDateTime, "2026-07-01T15:00:00.000Z");
});
