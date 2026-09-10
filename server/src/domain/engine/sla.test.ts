import { test } from "node:test";
import assert from "node:assert/strict";
import { businessDaysBetween, dueReminderStage, slaAlertDue, SLA_ALERT_BUSINESS_DAYS, SLA_REMINDER_STAGES } from "./sla.js";

// Reference anchor: 2026-06-01 is a Monday.
const MON = new Date("2026-06-01T09:00:00Z");

test("counts weekdays only, skipping the weekend", () => {
  // Mon → next Mon spans Sat+Sun → 5 business days, not 7.
  const nextMon = new Date("2026-06-08T09:00:00Z");
  assert.equal(businessDaysBetween(MON, nextMon), 5);
});

test("same day and reversed ranges are zero", () => {
  assert.equal(businessDaysBetween(MON, MON), 0);
  assert.equal(businessDaysBetween(new Date("2026-06-05T00:00:00Z"), MON), 0);
});

test("Friday submission: weekend does not count toward the SLA", () => {
  const fri = new Date("2026-06-05T09:00:00Z");
  // Following Mon/Tue/Wed = 3 business days elapsed.
  assert.equal(businessDaysBetween(fri, new Date("2026-06-10T09:00:00Z")), 3);
});

test("alert fires only at/after 5 business days", () => {
  // Mon submission; alert is due on the 5th business day = next Monday.
  assert.equal(slaAlertDue(MON, new Date("2026-06-05T23:59:00Z")), false); // Fri = 4 days
  assert.equal(slaAlertDue(MON, new Date("2026-06-08T09:00:00Z")), true); // Mon = 5 days
  assert.equal(SLA_ALERT_BUSINESS_DAYS, 5);
});

test("relances multi-étages : 0 avant J+2, puis 1 (J+2), 2 (J+4), 3 (J+6), 4 (J+7)", () => {
  // MON = lundi 01/06 ; mer 03/06 = 2 j ouvrés ; ven 05/06 = 4 ; mar 09/06 = 6 ; mer 10/06 = 7.
  assert.equal(dueReminderStage(MON, new Date("2026-06-02T09:00:00Z")), 0);
  assert.equal(dueReminderStage(MON, new Date("2026-06-03T09:00:00Z")), 1);
  assert.equal(dueReminderStage(MON, new Date("2026-06-05T09:00:00Z")), 2);
  assert.equal(dueReminderStage(MON, new Date("2026-06-09T09:00:00Z")), 3);
  assert.equal(dueReminderStage(MON, new Date("2026-06-10T09:00:00Z")), 4);
  assert.equal(SLA_REMINDER_STAGES.length, 4);
});
