/**
 * jeko.test.ts — fonctions pures de l'adaptateur Jèko : conversion centimes,
 * signature HMAC du webhook, référence par tentative, mapping des statuts,
 * et normalisation d'un webhook réel (payload de la doc officielle).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JEKO_METHODS, createJekoPaymentLink, expectedJekoSignature, fromJekoCents, jekoProvider,
  jekoReference, jekoSignaturesMatch, linkIdOf, linkRefOf, linkStatusOf, mapJekoStatus,
  paymentIdOfReference, toJekoCents,
} from "./jeko.js";

test("toJekoCents : 1 XOF (unité mineure) = 100 centimes — multiple de 100 garanti", () => {
  assert.equal(toJekoCents(100), 10_000); // 100 F → 10 000 centimes (minimum lien)
  assert.equal(toJekoCents(150_000), 15_000_000);
  assert.equal(toJekoCents(1) % 100, 0);
});

test("fromJekoCents : centimes → francs, refuse les montants non entiers", () => {
  assert.equal(fromJekoCents(10_000), 100);
  assert.equal(fromJekoCents(12_345), null); // pas un nombre entier de francs
  assert.equal(fromJekoCents("10000"), null);
  assert.equal(fromJekoCents(undefined), null);
});

test("signature : HMAC-SHA256 hex minuscule du corps brut, comparaison stricte", () => {
  const raw = '{"id":"txn_1","status":"success"}';
  const sig = expectedJekoSignature(raw, "secret-webhook");
  assert.match(sig, /^[0-9a-f]{64}$/);
  assert.equal(jekoSignaturesMatch(sig, sig.toUpperCase()), true); // casse tolérée
  assert.equal(jekoSignaturesMatch(sig, sig.slice(0, -1) + "0"), sig.endsWith("0")); // altération refusée
  assert.equal(jekoSignaturesMatch(sig, "court"), false); // longueur différente
  // Le moindre octet du corps change la signature (elle porte sur le brut).
  assert.notEqual(expectedJekoSignature(raw + " ", "secret-webhook"), sig);
});

test("référence par tentative : préfixe = paymentId, deux tentatives diffèrent", () => {
  const ref1 = jekoReference("cmpay123abc", 1_000_000);
  const ref2 = jekoReference("cmpay123abc", 1_000_001);
  assert.notEqual(ref1, ref2);
  assert.equal(paymentIdOfReference(ref1), "cmpay123abc");
  assert.ok(ref1.length >= 5 && ref1.length <= 100); // bornes Jèko
});

test("mapJekoStatus : pending/success/error → contrat, inconnu → UNKNOWN", () => {
  assert.equal(mapJekoStatus("success"), "SUCCEEDED");
  assert.equal(mapJekoStatus("error"), "FAILED");
  assert.equal(mapJekoStatus("pending"), "PENDING");
  assert.equal(mapJekoStatus("autre"), "UNKNOWN");
  assert.equal(mapJekoStatus(undefined), "UNKNOWN");
});

test("verifyWebhook : transaction plate signée → corrélée par transactionDetails.id", () => {
  // Payload TRANSACTION_COMPLETED de la documentation (« Structure du payload »).
  const raw = JSON.stringify({
    id: "txn_1234567890",
    amount: { amount: 10_000, currency: "XOF" },
    fees: { amount: 100, currency: "XOF" },
    status: "success",
    counterpartLabel: "John Doe",
    counterpartIdentifier: "+2250701234567",
    paymentMethod: "wave",
    transactionType: "PaymentRequest",
    description: "Payment for order #12345",
    executedAt: "2024-01-15 14:30:25",
    transactionDetails: { id: "d22c81f3-ee04", reference: "cmpay123abc-t7" },
  });
  const secret = "s3cret";
  const v = jekoProvider.verifyWebhook(
    { "jeko-signature": expectedJekoSignature(raw, secret) }, raw,
  ) as import("./provider.js").WebhookVerification;
  // Secret absent de l'env de test → la signature seule est refusée ; on
  // vérifie la normalisation, la politique de signature est testée à part.
  assert.equal(v.eventId, "txn_1234567890");
  assert.equal(v.providerRef, "d22c81f3-ee04");
  assert.equal(v.status, "SUCCEEDED");
  assert.equal(v.amountMinor, 100); // 10 000 centimes = 100 F
  assert.equal(v.currency, "XOF");
  assert.equal(v.method, "wave");
});

test("verifyWebhook : enveloppe { event } ou corps illisible → non corrélé (ignoré)", () => {
  const enveloppe = JSON.stringify({ event: "SERVICE_PROVIDER_LINK_REQUEST", payload: { id: "spl_1", status: "pending" } });
  const v1 = jekoProvider.verifyWebhook({}, enveloppe) as import("./provider.js").WebhookVerification;
  assert.equal(v1.providerRef, null);
  assert.equal(v1.status, "UNKNOWN");
  const v2 = jekoProvider.verifyWebhook({}, "pas du json") as import("./provider.js").WebhookVerification;
  assert.equal(v2.providerRef, null);
});

test("verifyWebhook : secours de corrélation par le préfixe de la référence", () => {
  const raw = JSON.stringify({ id: "txn_2", status: "success", transactionDetails: { reference: "cmpayXYZ-1a2b3c" } });
  const v = jekoProvider.verifyWebhook({}, raw) as import("./provider.js").WebhookVerification;
  assert.equal(v.providerRef, "cmpayXYZ");
});

test("createCheckout : refuse proprement sans configuration (aucun réseau)", async () => {
  await assert.rejects(
    () => jekoProvider.createCheckout({ paymentId: "p1", amountMinor: 1000, currency: "XOF", description: "test", returnUrl: "https://x", method: "wave" }),
    (e: { code?: string; statusCode?: number }) => e.code === "provider_unconfigured" && e.statusCode === 409,
  );
});

test("checkoutMethods : les 5 moyens documentés, exposés à l'écran d'achat", () => {
  assert.deepEqual([...(jekoProvider.checkoutMethods ?? [])], [...JEKO_METHODS]);
});

test("liens : providerRef préfixé pl:, aller-retour id ↔ ref", () => {
  assert.equal(linkRefOf("abc-123"), "pl:abc-123");
  assert.equal(linkIdOf("pl:abc-123"), "abc-123");
  assert.equal(linkIdOf("d22c81f3"), null); // une demande de paiement n'est pas un lien
});

test("linkStatusOf : usage unique — ouvert = PENDING, fermé = SUCCEEDED ; réutilisable/inconnu = UNKNOWN", () => {
  assert.equal(linkStatusOf({ allowMultiplePayments: false, canReceivePayments: true }), "PENDING");
  assert.equal(linkStatusOf({ allowMultiplePayments: false, canReceivePayments: false }), "SUCCEEDED");
  assert.equal(linkStatusOf({ allowMultiplePayments: true, canReceivePayments: true }), "UNKNOWN");
  assert.equal(linkStatusOf(null), "UNKNOWN");
  assert.equal(linkStatusOf({}), "UNKNOWN");
});

test("verifyWebhook : un paiement de LIEN se corrèle par paymentLinkId (préfixé)", () => {
  const raw = JSON.stringify({
    id: "txn_3", status: "success", paymentMethod: "orange",
    transactionDetails: { id: "pr-interne", reference: undefined, paymentLinkId: "lnk-42" },
  });
  const v = jekoProvider.verifyWebhook({}, raw) as import("./provider.js").WebhookVerification;
  assert.equal(v.providerRef, "pl:lnk-42"); // le lien prime sur l'id de demande
});

test("createJekoPaymentLink : refuse proprement sans configuration (aucun réseau)", async () => {
  await assert.rejects(
    () => createJekoPaymentLink({ title: "Facture TEST-000001", amountMinor: 50_000, currency: "XOF" }),
    (e: { code?: string; statusCode?: number }) => e.code === "provider_unconfigured" && e.statusCode === 409,
  );
});
