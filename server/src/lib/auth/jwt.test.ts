import { test } from "node:test";
import assert from "node:assert/strict";
import { signAccessToken, verifyAccessToken } from "./jwt.js";

test("sign then verify round-trips the subject + claims", async () => {
  const token = await signAccessToken({ sub: "u_123", role: "EVALUATOR", name: "Awa" });
  const payload = await verifyAccessToken(token);
  assert.equal(payload.sub, "u_123");
  assert.equal((payload as any).role, "EVALUATOR");
  assert.equal((payload as any).name, "Awa");
});

test("a tampered token is rejected", async () => {
  const token = await signAccessToken({ sub: "u_1", role: "LEARNER", name: "x" });
  const tampered = token.slice(0, -3) + (token.endsWith("aaa") ? "bbb" : "aaa");
  await assert.rejects(() => verifyAccessToken(tampered));
});

test("garbage is rejected", async () => {
  await assert.rejects(() => verifyAccessToken("not.a.jwt"));
});
