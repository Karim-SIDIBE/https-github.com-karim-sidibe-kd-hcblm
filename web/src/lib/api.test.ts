import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi, type Tokens } from "./api";

function box(initial: Tokens = {}) {
  let t = initial;
  return { get: () => t, set: (n: Tokens) => { t = n; }, _peek: () => t };
}

test("login stores tokens and returns the user", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ accessToken: "AT", refreshToken: "RT", user: { id: "u", name: "Awa", role: "LEARNER", email: "a@b.c" } }), { status: 200 })) as any;
  const b = box();
  const api = createApi("http://x/api/v1", b);
  const user = await api.login("a@b.c", "pw");
  assert.equal(user.name, "Awa");
  assert.equal(b._peek().access, "AT");
  assert.equal(b._peek().refresh, "RT");
});

test("a 401 triggers a refresh then retries with the new token", async () => {
  const seen: string[] = [];
  let n = 0;
  globalThis.fetch = (async (url: string, init: any) => {
    seen.push(`${init.method} ${url} auth=${init.headers?.authorization ?? "-"}`);
    if (url.endsWith("/auth/refresh")) return new Response(JSON.stringify({ accessToken: "AT2", refreshToken: "RT2" }), { status: 200 });
    n++;
    return n === 1
      ? new Response("{}", { status: 401 })
      : new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
  }) as any;

  const b = box({ access: "AT1", refresh: "RT1" });
  const api = createApi("http://x/api/v1", b);
  const res = await api.raw("GET", "/protected");
  assert.equal(res.status, 200);
  assert.equal(b.get().access, "AT2"); // rotated
  assert.ok(seen.some((s) => s.includes("auth=Bearer AT1"))); // first try
  assert.ok(seen.some((s) => s.includes("/auth/refresh")));   // refreshed
  assert.ok(seen.some((s) => s.includes("auth=Bearer AT2"))); // retried
});
