import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { expectedPaydunyaHash, parsePaydunyaIpn, paydunyaHashesMatch } from "./paydunya.js";

test("parsePaydunyaIpn met à plat le formulaire imbriqué à la PHP", () => {
  const raw = "data%5Bstatus%5D=completed&data%5Bhash%5D=abc&data%5Binvoice%5D%5Btoken%5D=tok_123&data%5Binvoice%5D%5Btotal_amount%5D=50000&data%5Bcustom_data%5D%5Bpayment_id%5D=pay_1";
  const f = parsePaydunyaIpn(raw);
  assert.equal(f["data.status"], "completed");
  assert.equal(f["data.invoice.token"], "tok_123");
  assert.equal(f["data.invoice.total_amount"], "50000");
  assert.equal(f["data.custom_data.payment_id"], "pay_1");
});

test("parsePaydunyaIpn tolère un corps JSON équivalent", () => {
  const f = parsePaydunyaIpn(JSON.stringify({ data: { status: "pending", invoice: { token: "tok_9" } } }));
  assert.equal(f["data.status"], "pending");
  assert.equal(f["data.invoice.token"], "tok_9");
});

test("le hash IPN attendu est le SHA-512 hex de la MASTER KEY", () => {
  const master = "test_master_key";
  assert.equal(expectedPaydunyaHash(master), createHash("sha512").update(master).digest("hex"));
});

test("comparaison de hash : insensible à la casse, refuse tout écart", () => {
  const h = expectedPaydunyaHash("k");
  assert.ok(paydunyaHashesMatch(h, h.toUpperCase()));
  assert.ok(!paydunyaHashesMatch(h, h.slice(0, -1) + (h.endsWith("0") ? "1" : "0")));
  assert.ok(!paydunyaHashesMatch(h, "court"));
});
