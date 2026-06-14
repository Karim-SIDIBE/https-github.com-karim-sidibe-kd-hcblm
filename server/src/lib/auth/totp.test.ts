import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Encode, base32Decode, totpCode, verifyTotp, generateTotpSecret, otpauthUrl } from "./totp.js";

// RFC 6238 Appendix B uses the ASCII seed "12345678901234567890" (SHA1).
const SEED = base32Encode(Buffer.from("12345678901234567890", "ascii"));

test("base32 round-trips arbitrary bytes", () => {
  const b = Buffer.from("12345678901234567890", "ascii");
  assert.deepEqual(base32Decode(base32Encode(b)), b);
});

test("RFC 6238 SHA1 test vectors (8-digit) match", () => {
  // time (s) → expected 8-digit code (RFC 6238, SHA1 rows)
  const vectors: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ];
  for (const [secs, code] of vectors) {
    assert.equal(totpCode(SEED, { time: secs * 1000, digits: 8 }), code, `t=${secs}`);
  }
});

test("default 6-digit code is the last 6 of the RFC vector", () => {
  assert.equal(totpCode(SEED, { time: 59_000 }), "287082");
});

test("verifyTotp accepts the current code and tolerates ±1 step drift", () => {
  const now = 1_700_000_000_000;
  const code = totpCode(SEED, { time: now });
  assert.equal(verifyTotp(SEED, code, { time: now }), true);
  // a code from the previous 30s step still verifies with window=1
  const prev = totpCode(SEED, { time: now - 30_000 });
  assert.equal(verifyTotp(SEED, prev, { time: now, window: 1 }), true);
});

test("verifyTotp rejects wrong, malformed, and far-out-of-window codes", () => {
  const now = 1_700_000_000_000;
  assert.equal(verifyTotp(SEED, "000000", { time: now }), false);
  assert.equal(verifyTotp(SEED, "abc", { time: now }), false);
  assert.equal(verifyTotp(SEED, "", { time: now }), false);
  const old = totpCode(SEED, { time: now - 5 * 30_000 });
  assert.equal(verifyTotp(SEED, old, { time: now, window: 1 }), false);
});

test("generateTotpSecret yields a decodable base32 secret; otpauthUrl is well-formed", () => {
  const s = generateTotpSecret();
  assert.ok(base32Decode(s).length >= 20);
  const url = otpauthUrl(s, "user@example.com");
  assert.match(url, /^otpauth:\/\/totp\/.*[?&]secret=/);
  assert.match(url, /algorithm=SHA1/);
});
