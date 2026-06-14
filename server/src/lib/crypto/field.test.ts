import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encryptWith, decryptWith, isEncrypted } from "./field.js";

test("encrypt → decrypt round-trips and tags the ciphertext", () => {
  const key = randomBytes(32);
  const enc = encryptWith(key, "JBSWY3DPEHPK3PXP"); // a TOTP base32 secret
  assert.ok(isEncrypted(enc));
  assert.ok(!enc.includes("JBSWY3DPEHPK3PXP")); // plaintext absent from ciphertext
  assert.equal(decryptWith(key, enc), "JBSWY3DPEHPK3PXP");
});

test("ciphertext differs each call (random IV)", () => {
  const key = randomBytes(32);
  assert.notEqual(encryptWith(key, "same"), encryptWith(key, "same"));
});

test("a tampered ciphertext fails the GCM auth tag", () => {
  const key = randomBytes(32);
  const enc = encryptWith(key, "secret");
  const broken = enc.slice(0, -2) + (enc.endsWith("A") ? "B" : "A");
  assert.throws(() => decryptWith(key, broken));
});

test("wrong key cannot decrypt", () => {
  const enc = encryptWith(randomBytes(32), "secret");
  assert.throws(() => decryptWith(randomBytes(32), enc));
});

test("isEncrypted distinguishes legacy plaintext", () => {
  assert.equal(isEncrypted("JBSWY3DPEHPK3PXP"), false);
  assert.equal(isEncrypted(null), false);
});
