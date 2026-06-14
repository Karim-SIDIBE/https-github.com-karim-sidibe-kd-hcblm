import { test } from "node:test";
import assert from "node:assert/strict";
import { anonymizedUserPatch, summarizeSessions, describeDevice, ANON_EMAIL_DOMAIN, isErasureDue, daysUntilPurge, retentionCutoff } from "./rgpd.js";

test("isErasureDue respects the grace period", () => {
  const now = new Date("2026-06-14T00:00:00Z");
  const req = new Date("2026-05-15T00:00:00Z"); // 30 days earlier
  assert.equal(isErasureDue(req, now, 30), true);    // exactly due
  assert.equal(isErasureDue(req, now, 31), false);   // one more day to wait
  assert.equal(isErasureDue(null, now, 30), false);  // nothing scheduled
});

test("daysUntilPurge counts down then floors at 0", () => {
  const now = new Date("2026-06-14T00:00:00Z");
  assert.equal(daysUntilPurge(new Date("2026-06-04T00:00:00Z"), now, 30), 20);
  assert.equal(daysUntilPurge(new Date("2026-04-01T00:00:00Z"), now, 30), 0); // already past
});

test("retentionCutoff subtracts the window", () => {
  assert.equal(retentionCutoff(new Date("2026-06-14T00:00:00Z"), 365).toISOString(), "2025-06-14T00:00:00.000Z");
});

test("anonymizedUserPatch scrubs every direct identifier and neutralises auth", () => {
  const now = new Date("2026-06-14T10:00:00Z");
  const p = anonymizedUserPatch("u_123", now);
  assert.equal(p.email, `anonymized-u_123@${ANON_EMAIL_DOMAIN}`);
  assert.equal(p.name, "Compte supprimé");
  assert.equal(p.phone, null);
  assert.equal(p.passwordHash, null);          // no first-party login
  assert.equal(p.totpSecret, null);            // 2FA neutralised
  assert.equal(p.totpEnabledAt, null);
  assert.deepEqual(p.totpBackupCodes, []);
  assert.equal(p.disabledAt, now);             // blocked at login/refresh
  assert.equal(p.anonymizedAt, now);
});

test("anonymised e-mail keeps the unique constraint distinct per user", () => {
  assert.notEqual(anonymizedUserPatch("a").email, anonymizedUserPatch("b").email);
});

test("describeDevice derives a friendly label, never throws on junk", () => {
  assert.equal(describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0"), "Chrome · Windows");
  assert.equal(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1"), "Safari · iOS");
  assert.equal(describeDevice(null), "Appareil inconnu");
  assert.equal(describeDevice(""), "Appareil inconnu");
});

test("summarizeSessions: one line per device, newest first, current flagged", () => {
  const rows = [
    { familyId: "famA", userAgent: "Chrome", ip: "1.1.1.1", lastUsedAt: new Date("2026-06-14T09:00:00Z"), createdAt: new Date("2026-06-01T00:00:00Z") },
    // older token of the same family must collapse into the recent one
    { familyId: "famA", userAgent: "Chrome", ip: "1.1.1.1", lastUsedAt: new Date("2026-06-10T00:00:00Z"), createdAt: new Date("2026-06-01T00:00:00Z") },
    { familyId: "famB", userAgent: "Firefox", ip: "2.2.2.2", lastUsedAt: new Date("2026-06-14T12:00:00Z"), createdAt: new Date("2026-06-02T00:00:00Z") },
  ];
  const out = summarizeSessions(rows, "famA");
  assert.equal(out.length, 2);                 // 3 rows → 2 devices
  assert.equal(out[0]!.familyId, "famB");      // most recent activity first
  assert.equal(out[0]!.current, false);
  assert.equal(out[1]!.familyId, "famA");
  assert.equal(out[1]!.current, true);         // caller's own session flagged
  assert.equal(out[1]!.lastUsedAt.toISOString(), "2026-06-14T09:00:00.000Z"); // newest of the family
});

test("summarizeSessions falls back to createdAt when never refreshed", () => {
  const out = summarizeSessions([{ familyId: "f", userAgent: null, ip: null, lastUsedAt: null, createdAt: new Date("2026-06-01T00:00:00Z") }]);
  assert.equal(out[0]!.lastUsedAt.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(out[0]!.device, "Appareil inconnu");
});
