/**
 * payments.service.ts — socle paiement (lot PAY-1, spec « Architecture v3 »).
 *
 * Invariants tenus ici :
 *  - le montant d'une commande est RELU depuis Price côté serveur (jamais du
 *    client), figé à la création, re-vérifié à chaque événement ;
 *  - seul un webhook signé + CONTRE-VÉRIFIÉ (fetchStatus) — ou le constat
 *    staff audité pour `manual` — fait passer une commande à PAID ;
 *  - une commande PAID émet le droit d'accès (Entitlement), seul objet qui
 *    débloque un cours ou crédite des sièges ;
 *  - idempotence stricte : PaymentEvent @@unique(provider, eventId), commande
 *    PENDING réutilisée (anti double-clic), transition PAID à garde atomique.
 */
import type { Role } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { audit } from "../../lib/audit.js";
import { env } from "../../config/env.js";
import { isStaff } from "../../domain/auth/permissions.js";
import { formatAmount, isCurrency, toAmountMinor, type Currency } from "../../domain/payments/money.js";
import { ProviderError, type ProviderKey } from "../../lib/payments/provider.js";
import { PROVIDERS, PROVIDER_ENUM, getActiveProvider } from "../../lib/payments/registry.js";

export class PaymentError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

type Principal = { id: string; role: Role };

// --- produits & prix (outillage minimal du socle — l'admin complet est PAY-2) --

export async function createProduct(input: { type: "COURSE" | "SEATS"; title: string; courseId?: string; seatCount?: number }) {
  if (input.type === "COURSE") {
    if (!input.courseId) throw new PaymentError(422, "course_required", "Un produit COURSE doit référencer un cours");
    const course = await prisma.course.findUnique({ where: { id: input.courseId }, include: { product: true } });
    if (!course) throw new PaymentError(404, "course_not_found", "Cours introuvable");
    if (course.product) throw new PaymentError(409, "product_exists", "Ce cours a déjà un produit");
  }
  if (input.type === "SEATS" && !(Number.isInteger(input.seatCount) && input.seatCount! > 0)) {
    throw new PaymentError(422, "seat_count_required", "Un produit SEATS doit porter un nombre de sièges positif");
  }
  return prisma.product.create({
    data: {
      type: input.type, title: input.title,
      courseId: input.type === "COURSE" ? input.courseId : null,
      seatCount: input.type === "SEATS" ? input.seatCount : null,
    },
  });
}

/** Un prix rédigé PAR DEVISE (montant saisi en unités majeures). */
export async function upsertPrice(productId: string, currency: string, amountMajor: string | number) {
  if (!isCurrency(currency)) throw new PaymentError(422, "bad_currency", "Devise attendue : XOF, XAF ou EUR");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new PaymentError(404, "product_not_found", "Produit introuvable");
  let amountMinor: number;
  try { amountMinor = toAmountMinor(amountMajor, currency); }
  catch (e) { throw new PaymentError(422, "bad_amount", e instanceof Error ? e.message : "Montant invalide"); }
  return prisma.price.upsert({
    where: { productId_currency: { productId, currency } },
    update: { amountMinor, active: true },
    create: { productId, currency, amountMinor },
  });
}

export async function listProducts() {
  const rows = await prisma.product.findMany({ where: { active: true }, include: { prices: { where: { active: true } } }, orderBy: { createdAt: "desc" } });
  return rows.map((p) => ({
    ...p,
    prices: p.prices.map((pr) => ({ ...pr, display: formatAmount(pr.amountMinor, pr.currency as Currency) })),
  }));
}

// --- commandes -----------------------------------------------------------------

function assertOrderAccess(principal: Principal, order: { buyerUserId: string | null }) {
  if (order.buyerUserId !== principal.id && !isStaff(principal.role)) {
    throw new PaymentError(403, "forbidden", "Cette commande ne vous appartient pas");
  }
}

/** Crée (ou réutilise) l'intention d'achat — montant/devise RELUS en base et figés. */
export async function createOrder(principal: Principal, input: { productId: string; currency: string; buyerOrgId?: string; quantity?: number }) {
  if (!isCurrency(input.currency)) throw new PaymentError(422, "bad_currency", "Devise attendue : XOF, XAF ou EUR");
  const quantity = input.quantity ?? 1;
  if (!(Number.isInteger(quantity) && quantity >= 1 && quantity <= 100)) throw new PaymentError(422, "bad_quantity", "Quantité entre 1 et 100");

  const product = await prisma.product.findUnique({ where: { id: input.productId }, include: { prices: true } });
  if (!product?.active) throw new PaymentError(404, "product_not_found", "Produit introuvable ou inactif");
  const price = product.prices.find((p) => p.currency === input.currency && p.active);
  if (!price) throw new PaymentError(422, "no_price", `Aucun prix rédigé en ${input.currency} pour ce produit`);

  let buyerOrgId: string | null = null;
  if (input.buyerOrgId) {
    // Le parcours d'achat entreprise en libre-service arrive en PAY-3 ; au
    // socle, une commande pour une organisation est un acte staff.
    if (!isStaff(principal.role)) throw new PaymentError(403, "forbidden", "Commande pour une organisation : réservée au staff (portail entreprise : lot PAY-3)");
    const org = await prisma.organization.findUnique({ where: { id: input.buyerOrgId } });
    if (!org) throw new PaymentError(404, "org_not_found", "Organisation introuvable");
    buyerOrgId = org.id;
  }
  if (product.type === "SEATS" && !buyerOrgId) throw new PaymentError(422, "org_required", "Un lot de sièges s'achète pour une organisation");

  // Anti double-clic : une commande PENDING identique est réutilisée, pas recréée.
  const existing = await prisma.order.findFirst({
    where: { productId: product.id, currency: input.currency, status: "PENDING", buyerUserId: buyerOrgId ? null : principal.id, buyerOrgId, quantity },
  });
  if (existing) return { order: existing, reused: true };

  const order = await prisma.order.create({
    data: {
      productId: product.id,
      buyerUserId: buyerOrgId ? null : principal.id,
      buyerOrgId,
      quantity,
      amountMinor: price.amountMinor * quantity,
      currency: input.currency,
    },
  });
  await audit({ actorId: principal.id, action: "payment.order.create", targetType: "Order", targetId: order.id, meta: { productId: product.id, amountMinor: order.amountMinor, currency: order.currency, quantity } });
  return { order, reused: false };
}

export async function getOrder(principal: Principal, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: true, payments: { orderBy: { createdAt: "desc" } }, entitlements: true },
  });
  if (!order) throw new PaymentError(404, "order_not_found", "Commande introuvable");
  assertOrderAccess(principal, order);
  return { ...order, display: formatAmount(order.amountMinor, order.currency as Currency) };
}

/** Démarre un règlement sur le FOURNISSEUR ACTIF (checkout hébergé, ou
 *  références de virement pour `manual`). Réutilise le paiement INITIATED
 *  existant du même fournisseur (anti double-débit). */
export async function startCheckout(principal: Principal, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { product: true } });
  if (!order) throw new PaymentError(404, "order_not_found", "Commande introuvable");
  assertOrderAccess(principal, order);
  if (order.status !== "PENDING") throw new PaymentError(409, "order_not_pending", `Commande déjà ${order.status}`);

  const provider = await getActiveProvider();
  const providerId = PROVIDER_ENUM[provider.key];
  const payment = await prisma.payment.findFirst({ where: { orderId: order.id, provider: providerId, status: "INITIATED" } })
    ?? await prisma.payment.create({ data: { orderId: order.id, provider: providerId, amountMinor: order.amountMinor, currency: order.currency } });

  const buyer = order.buyerUserId ? await prisma.user.findUnique({ where: { id: order.buyerUserId } }) : null;
  const checkout = await provider.createCheckout({
    paymentId: payment.id,
    amountMinor: order.amountMinor,
    currency: order.currency as Currency,
    description: `${order.product.title} × ${order.quantity}`,
    returnUrl: `${env.APP_BASE_URL ?? env.PUBLIC_BASE_URL}/paiement/retour?order=${order.id}`,
    customer: buyer ? { email: buyer.email, name: buyer.name } : undefined,
  });
  await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: checkout.providerRef } });
  await audit({ actorId: principal.id, action: "payment.checkout.start", targetType: "Payment", targetId: payment.id, meta: { provider: provider.key, orderId: order.id } });
  return { paymentId: payment.id, provider: provider.key, paymentUrl: checkout.paymentUrl, instructions: checkout.instructions ?? null };
}

// --- règlement -----------------------------------------------------------------

/** Transition PENDING → PAID + émission du droit d'accès, atomique et
 *  idempotente (la garde updateMany ne laisse passer qu'un seul règlement). */
async function settleOrder(orderId: string, paymentId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const guarded = await tx.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "PAID" } });
    if (guarded.count === 0) return false; // déjà réglée (rejeu) — rien à refaire
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { product: true } });
    if (order.product.type === "COURSE") {
      await tx.entitlement.create({
        data: {
          holderUserId: order.buyerUserId, holderOrgId: order.buyerUserId ? null : order.buyerOrgId,
          scope: "COURSE_ACCESS", courseId: order.product.courseId, source: "PURCHASE", orderId: order.id,
        },
      });
    } else {
      const seats = (order.product.seatCount ?? 0) * order.quantity;
      await tx.entitlement.create({
        data: { holderOrgId: order.buyerOrgId, scope: "SEATS", seats, source: "PURCHASE", orderId: order.id },
      });
      if (order.buyerOrgId) {
        await tx.organization.update({ where: { id: order.buyerOrgId }, data: { seats: { increment: seats } } });
      }
    }
    await tx.payment.update({ where: { id: paymentId }, data: { status: "SUCCEEDED" } });
    return true;
  });
}

/** Constat staff d'un règlement `manual` (virement reçu, vente hors-ligne) —
 *  joue le rôle du webhook : audité, idempotent, mêmes droits. */
export async function markPaidManual(principal: Principal, orderId: string, reference: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new PaymentError(404, "order_not_found", "Commande introuvable");
  if (order.status === "PAID") throw new PaymentError(409, "already_paid", "Commande déjà réglée");
  if (order.status !== "PENDING") throw new PaymentError(409, "order_not_pending", `Commande ${order.status}`);

  const payment = await prisma.payment.findFirst({ where: { orderId: order.id, provider: "MANUAL", status: "INITIATED" } })
    ?? await prisma.payment.create({ data: { orderId: order.id, provider: "MANUAL", amountMinor: order.amountMinor, currency: order.currency } });
  await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: reference, method: "virement" } });
  const settled = await settleOrder(order.id, payment.id);
  await audit({ actorId: principal.id, action: "payment.manual.confirm", targetType: "Order", targetId: order.id, meta: { paymentId: payment.id, reference, settled } });
  if (!settled) throw new PaymentError(409, "already_paid", "Commande déjà réglée");
  return getOrderInternal(order.id);
}

async function getOrderInternal(orderId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { product: true, payments: true, entitlements: true } });
}

// --- webhooks entrants ----------------------------------------------------------

export type WebhookOutcome = { httpStatus: number; body: Record<string, unknown> };

/** Traite un webhook d'agrégateur : signature sur corps brut → journal
 *  idempotent → cohérence montant/devise → CONTRE-VÉRIFICATION fetchStatus →
 *  règlement. Un même événement rejoué n'est traité qu'une fois. */
export async function handleProviderWebhook(key: ProviderKey, headers: Record<string, string | string[] | undefined>, rawBody: string, ip?: string): Promise<WebhookOutcome> {
  const provider = PROVIDERS[key];
  if (!provider || key === "manual") return { httpStatus: 404, body: { error: "unknown_provider" } };
  const providerId = PROVIDER_ENUM[key];
  const v = await provider.verifyWebhook(headers, rawBody);

  // Signature invalide : journalisé et ignoré — sous une clé NON bloquante,
  // sinon un faux webhook consommerait l'eventId et permettrait de bloquer
  // l'événement légitime qui suivra (déni de service sur le règlement).
  if (!v.signatureOk) {
    const rejected = await prisma.paymentEvent.create({
      data: { provider: providerId, eventId: `invalid:${crypto.randomUUID()}`, signatureOk: false, rawPayload: { claimedEventId: v.eventId, raw: rawBody.slice(0, 10_000) } },
    });
    await audit({ action: "payment.webhook.rejected", targetType: "PaymentEvent", targetId: rejected.id, ip, meta: { provider: key, reason: "signature_invalid", claimedEventId: v.eventId } });
    return { httpStatus: 401, body: { error: "signature_invalid", message: "Signature du webhook invalide — événement journalisé et ignoré" } };
  }

  // Journal idempotent AVANT tout traitement : rejeu → même (provider, eventId).
  let eventRowId: string;
  try {
    const row = await prisma.paymentEvent.create({
      data: { provider: providerId, eventId: v.eventId, signatureOk: true, rawPayload: { raw: rawBody.slice(0, 10_000) } },
    });
    eventRowId = row.id;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { httpStatus: 200, body: { data: { duplicate: true } } };
    throw e;
  }

  const payment = v.providerRef
    ? await prisma.payment.findFirst({ where: { id: v.providerRef, provider: providerId }, include: { order: true } })
    : null;
  if (!payment) {
    await prisma.paymentEvent.update({ where: { id: eventRowId }, data: { processedAt: new Date() } });
    await audit({ action: "payment.webhook.ignored", targetType: "PaymentEvent", targetId: eventRowId, ip, meta: { provider: key, providerRef: v.providerRef, reason: "payment_not_found" } });
    return { httpStatus: 202, body: { data: { ignored: true } } };
  }

  // Cohérence montant/devise annoncés vs figés sur le paiement.
  if ((v.amountMinor !== undefined && v.amountMinor !== payment.amountMinor) || (v.currency && v.currency !== payment.currency)) {
    await prisma.paymentEvent.update({ where: { id: eventRowId }, data: { paymentId: payment.id, processedAt: new Date() } });
    await audit({ action: "payment.webhook.mismatch", targetType: "Payment", targetId: payment.id, ip, meta: { provider: key, announced: { amountMinor: v.amountMinor, currency: v.currency }, expected: { amountMinor: payment.amountMinor, currency: payment.currency } } });
    return { httpStatus: 409, body: { error: "amount_mismatch", message: "Montant/devise du webhook incohérents avec le paiement — non réglé, à réconcilier" } };
  }

  // Contre-vérification systématique auprès du fournisseur (le webhook n'est
  // qu'un réveil — pour CinetPay, /v2/payment/check est la seule vérité).
  const check = await provider.fetchStatus(payment.id).catch((e) => {
    if (e instanceof ProviderError) return { status: "UNKNOWN" as const, raw: e.message };
    throw e;
  });

  let result: string = check.status;
  if (check.status === "SUCCEEDED") {
    const settled = await settleOrder(payment.orderId, payment.id);
    if (v.method) await prisma.payment.update({ where: { id: payment.id }, data: { method: v.method } });
    result = settled ? "settled" : "already_settled";
  } else if (check.status === "FAILED") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    const others = await prisma.payment.count({ where: { orderId: payment.orderId, status: { in: ["INITIATED", "SUCCEEDED"] }, NOT: { id: payment.id } } });
    if (others === 0) await prisma.order.updateMany({ where: { id: payment.orderId, status: "PENDING" }, data: { status: "FAILED" } });
  }

  await prisma.paymentEvent.update({ where: { id: eventRowId }, data: { paymentId: payment.id, processedAt: new Date() } });
  await audit({ action: "payment.webhook.processed", targetType: "Payment", targetId: payment.id, ip, meta: { provider: key, eventId: v.eventId, result } });
  return { httpStatus: 200, body: { data: { processed: true, result } } };
}

// --- vue d'ensemble fournisseurs -----------------------------------------------

export async function providersOverview() {
  const active = (await getActiveProvider()).key;
  return Object.values(PROVIDERS).map((p) => ({ key: p.key, available: p.available(), active: p.key === active }));
}
