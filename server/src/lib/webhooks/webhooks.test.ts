import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signPayload } from "./webhooks.js";

test("signPayload is a stable HMAC-SHA256 hex digest", () => {
  const body = JSON.stringify({ event: "BADGE_ISSUED", data: { x: 1 } });
  const sig = signPayload("s3cr3t", body);
  assert.match(sig, /^[0-9a-f]{64}$/);
  // matches an independent HMAC computation (receiver-side verification)
  assert.equal(sig, createHmac("sha256", "s3cr3t").update(body).digest("hex"));
});

test("different secrets or bodies yield different signatures", () => {
  const body = '{"a":1}';
  assert.notEqual(signPayload("k1", body), signPayload("k2", body));
  assert.notEqual(signPayload("k1", body), signPayload("k1", '{"a":2}'));
});
