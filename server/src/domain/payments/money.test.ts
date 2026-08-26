import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRENCIES, MINOR_DIGITS, formatAmount, isCurrency, isValidAmountMinor, toAmountMinor } from "./money.js";

test("devises supportées : XOF, XAF, EUR — et rien d'autre", () => {
  assert.deepEqual([...CURRENCIES], ["XOF", "XAF", "EUR"]);
  assert.equal(isCurrency("XOF"), true);
  assert.equal(isCurrency("USD"), false);
  assert.equal(MINOR_DIGITS.XOF, 0);
  assert.equal(MINOR_DIGITS.EUR, 2);
});

test("formatage : F CFA en unités entières, euro en centimes", () => {
  assert.equal(formatAmount(15000, "XOF"), "15 000 F CFA");
  assert.equal(formatAmount(15000, "XAF"), "15 000 F CFA");
  assert.equal(formatAmount(2500, "EUR"), "25,00 €");
  assert.equal(formatAmount(2505, "EUR"), "25,05 €");
  assert.equal(formatAmount(1, "XOF"), "1 F CFA");
});

test("les montants sont des entiers strictement positifs et bornés", () => {
  assert.equal(isValidAmountMinor(15000), true);
  assert.equal(isValidAmountMinor(0), false);
  assert.equal(isValidAmountMinor(-5), false);
  assert.equal(isValidAmountMinor(12.5), false);
  assert.equal(isValidAmountMinor(2_000_000_000), false);
  assert.throws(() => formatAmount(12.5, "XOF"));
});

test("saisie en unités majeures → unité mineure, sans perte de précision", () => {
  assert.equal(toAmountMinor("15000", "XOF"), 15000);
  assert.equal(toAmountMinor("25,50", "EUR"), 2550);
  assert.equal(toAmountMinor("25.5", "EUR"), 2550);
  assert.equal(toAmountMinor(25, "EUR"), 2500);
  assert.throws(() => toAmountMinor("25.505", "EUR"), /décimales/); // perte de précision refusée
  assert.throws(() => toAmountMinor("15 000,5", "XOF"), /décimales/); // pas de subdivision du F CFA
  assert.throws(() => toAmountMinor("abc", "XOF"));
  assert.throws(() => toAmountMinor("-5", "XOF"));
});
