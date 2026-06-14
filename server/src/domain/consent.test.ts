import { test } from "node:test";
import assert from "node:assert/strict";
import { currentConsentState, CONSENT_POLICIES, isConsentType } from "./consent.js";

test("isConsentType guards unknown types", () => {
  assert.equal(isConsentType("marketing"), true);
  assert.equal(isConsentType("tracking"), false);
});

test("no rows → nothing granted, required flags surfaced", () => {
  const s = currentConsentState([]);
  const terms = s.find((x) => x.type === "terms")!;
  assert.equal(terms.granted, false);
  assert.equal(terms.required, true);
  assert.equal(terms.acceptedVersion, null);
});

test("latest row wins; revoked → not granted", () => {
  const v = CONSENT_POLICIES.marketing.version;
  const s = currentConsentState([
    { type: "marketing", version: v, grantedAt: new Date("2026-06-01"), revokedAt: null },
    { type: "marketing", version: v, grantedAt: new Date("2026-06-10"), revokedAt: new Date("2026-06-11") }, // newer, revoked
  ]);
  assert.equal(s.find((x) => x.type === "marketing")!.granted, false);
});

test("active consent to an OLD version is not 'granted' against the current one", () => {
  const s = currentConsentState([{ type: "privacy", version: "2020-01", grantedAt: new Date("2020-01-01"), revokedAt: null }]);
  const privacy = s.find((x) => x.type === "privacy")!;
  assert.equal(privacy.granted, false);               // re-prompt needed
  assert.equal(privacy.acceptedVersion, "2020-01");   // but we remember what they accepted
});

test("active consent to the current version → granted", () => {
  const v = CONSENT_POLICIES.terms.version;
  const s = currentConsentState([{ type: "terms", version: v, grantedAt: new Date("2026-06-05"), revokedAt: null }]);
  assert.equal(s.find((x) => x.type === "terms")!.granted, true);
});
