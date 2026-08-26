import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { CINETPAY_HMAC_FIELDS, computeCinetpayToken, parseNotificationBody, tokensMatch } from "./cinetpay.js";

const FIELDS = {
  cpm_site_id: "445160", cpm_trans_id: "pay_123", cpm_trans_date: "2026-08-26 12:00:00",
  cpm_amount: "15000", cpm_currency: "XOF", signature: "sig", payment_method: "OMCIV2", cel_phone_num: "0700000000",
};

test("x-token = HMAC-SHA256 sur la concaténation documentée des champs", () => {
  const secret = "secret-test";
  const joined = CINETPAY_HMAC_FIELDS.map((f) => (FIELDS as Record<string, string>)[f] ?? "").join("");
  const expected = createHmac("sha256", secret).update(joined).digest("hex");
  assert.equal(computeCinetpayToken(FIELDS, secret), expected);
  // Champ manquant → chaîne vide à sa place (jeton différent, pas d'exception).
  assert.notEqual(computeCinetpayToken({ ...FIELDS, payment_method: undefined }, secret), expected);
});

test("comparaison de jetons à temps constant (longueur d'abord)", () => {
  const t = computeCinetpayToken(FIELDS, "s");
  assert.equal(tokensMatch(t, t), true);
  assert.equal(tokensMatch(t, t.slice(0, -1) + (t.endsWith("0") ? "1" : "0")), false);
  assert.equal(tokensMatch(t, "court"), false); // longueurs différentes → false sans lever
});

test("corps de notification : formulaire urlencodé ET JSON acceptés", () => {
  const form = new URLSearchParams(FIELDS).toString();
  assert.deepEqual(parseNotificationBody(form).cpm_trans_id, "pay_123");
  assert.deepEqual(parseNotificationBody(JSON.stringify(FIELDS)).cpm_amount, "15000");
  // Corps illisible → jamais d'exception, et aucun champ cpm_* exploitable.
  assert.equal(parseNotificationBody("{corrompu").cpm_trans_id, undefined);
});
