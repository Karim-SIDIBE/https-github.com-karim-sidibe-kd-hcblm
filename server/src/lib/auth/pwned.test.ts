import { test } from "node:test";
import assert from "node:assert/strict";
import { isSuffixPwned } from "./pwned.js";

// HIBP range bodies are CRLF lines of "SUFFIX:count" (suffix = SHA1[5..]).
const body = "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2\r\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:9";

test("isSuffixPwned matches a present suffix (case-insensitive)", () => {
  assert.equal(isSuffixPwned(body, "0018A45C4D1DEF81644B54AB7F969B88D65"), true);
  assert.equal(isSuffixPwned(body, "0018a45c4d1def81644b54ab7f969b88d65"), true); // lowercased
});

test("isSuffixPwned returns false for an absent suffix", () => {
  assert.equal(isSuffixPwned(body, "1111111111111111111111111111111111A"), false);
});

test("isSuffixPwned tolerates trailing/last-line without newline", () => {
  assert.equal(isSuffixPwned(body, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"), true);
});
