import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedIp, assertPublicUrl, SsrfBlockedError } from "./ssrf-guard.js";

test("isBlockedIp flags loopback, private, link-local and reserved ranges", () => {
  for (const ip of [
    "127.0.0.1", "127.5.5.5",     // loopback
    "10.0.0.1", "10.255.1.2",     // private /8
    "172.16.0.1", "172.31.255.1", // private /12
    "192.168.1.1",                // private /16
    "169.254.169.254",            // link-local (cloud metadata)
    "100.64.0.1",                 // CGNAT
    "0.0.0.0",                    // unspecified
    "224.0.0.1", "239.1.2.3",     // multicast
    "::1", "::",                  // v6 loopback / unspecified
    "fe80::1",                    // v6 link-local
    "fd00::1", "fc00::1",         // v6 ULA
    "::ffff:127.0.0.1",           // v4-mapped loopback
    "::ffff:10.0.0.1",            // v4-mapped private
  ]) {
    assert.equal(isBlockedIp(ip), true, `${ip} should be blocked`);
  }
});

test("isBlockedIp allows ordinary public addresses", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "192.169.0.1", "2606:4700:4700::1111"]) {
    assert.equal(isBlockedIp(ip), false, `${ip} should be allowed`);
  }
});

test("isBlockedIp refuses non-IP input", () => {
  assert.equal(isBlockedIp("not-an-ip"), true);
  assert.equal(isBlockedIp(""), true);
});

test("assertPublicUrl rejects non-http(s) schemes", async () => {
  for (const u of ["ftp://example.com", "file:///etc/passwd", "gopher://x"]) {
    await assert.rejects(() => assertPublicUrl(u), SsrfBlockedError);
  }
});

test("assertPublicUrl rejects literal internal IP hosts without DNS", async () => {
  for (const u of ["http://127.0.0.1/x", "http://169.254.169.254/latest/meta-data", "http://[::1]:9200/", "https://10.1.2.3/hook"]) {
    await assert.rejects(() => assertPublicUrl(u), SsrfBlockedError);
  }
});

test("assertPublicUrl allows a literal public IP host", async () => {
  await assert.doesNotReject(() => assertPublicUrl("https://8.8.8.8/webhook"));
});

test("assertPublicUrl rejects an invalid URL", async () => {
  await assert.rejects(() => assertPublicUrl("http://"), SsrfBlockedError);
});
