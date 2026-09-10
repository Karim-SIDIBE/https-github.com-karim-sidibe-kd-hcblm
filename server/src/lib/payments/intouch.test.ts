import { test } from "node:test";
import assert from "node:assert/strict";
import { mapIntouchStatus, parseIntouchNotification } from "./intouch.js";

test("parseIntouchNotification lit l'enveloppe { query, body } (corps JSON)", () => {
  const raw = JSON.stringify({ query: { s: "secret", order_number: "pay_1" }, body: JSON.stringify({ status: "SUCCESSFUL", payment_mode: "OM" }) });
  const { query, fields } = parseIntouchNotification(raw);
  assert.equal(query.s, "secret");
  assert.equal(query.order_number, "pay_1");
  assert.equal(fields.status, "SUCCESSFUL");
  assert.equal(fields.payment_mode, "OM");
});

test("parseIntouchNotification lit un corps formulaire et survit à un corps vide", () => {
  const form = parseIntouchNotification(JSON.stringify({ query: {}, body: "status=FAILED&id_transaction=tx9" }));
  assert.equal(form.fields.status, "FAILED");
  assert.equal(form.fields.id_transaction, "tx9");
  const empty = parseIntouchNotification(JSON.stringify({ query: { s: "x" }, body: "" }));
  assert.deepEqual(empty.fields, {});
  assert.equal(empty.query.s, "x");
});

test("mapIntouchStatus : succès, échecs et attentes reconnus, le reste UNKNOWN", () => {
  assert.equal(mapIntouchStatus("SUCCESSFUL"), "SUCCEEDED");
  assert.equal(mapIntouchStatus("payment_validation"), "SUCCEEDED");
  assert.equal(mapIntouchStatus("CANCELLED"), "FAILED");
  assert.equal(mapIntouchStatus("PENDING"), "PENDING");
  assert.equal(mapIntouchStatus("bizarre"), "UNKNOWN");
  assert.equal(mapIntouchStatus(undefined), "UNKNOWN");
});
