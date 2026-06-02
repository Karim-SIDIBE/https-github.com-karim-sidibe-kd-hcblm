import { test } from "node:test";
import assert from "node:assert/strict";
import { injectMomentAncrage, containsToken } from "./injection.js";
import { MOMENT_ANCRAGE_TOKEN } from "../content-model.js";

test("replaces the token throughout a nested structure", () => {
  const input = { a: `voici ${MOMENT_ANCRAGE_TOKEN}`, b: [{ c: MOMENT_ANCRAGE_TOKEN }], d: 3 };
  const out = injectMomentAncrage(input, "ma situation");
  assert.equal(out.a, "voici ma situation");
  assert.equal(out.b[0]!.c, "ma situation");
  assert.equal(out.d, 3);
  assert.equal(containsToken(out), false);
});

test("uses a neutral fallback when the PAM is empty", () => {
  const out = injectMomentAncrage({ x: MOMENT_ANCRAGE_TOKEN }, "");
  assert.ok(!out.x.includes(MOMENT_ANCRAGE_TOKEN));
  assert.ok(out.x.length > 0);
});

test("containsToken detects the token", () => {
  assert.equal(containsToken({ a: [`${MOMENT_ANCRAGE_TOKEN}`] }), true);
  assert.equal(containsToken({ a: "rien" }), false);
});
