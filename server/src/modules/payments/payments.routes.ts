/**
 * payments.routes.ts — surface HTTP du socle paiement (PAY-1).
 * La logique vit dans payments.service ; ici : validation Zod, gardes RBAC,
 * et les DEUX endpoints webhook publics (toujours ouverts, chacun vérifié
 * avec la clé de SON fournisseur — spec §09).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticate, guard } from "../../lib/auth.js";
import { env } from "../../config/env.js";
import { ProviderError } from "../../lib/payments/provider.js";
import { PaymentError, courseCatalog, guestCheckout, guestCourseInfo, guestGetOrder, guestReceipt, guestResumeCheckout, createOrder, createProduct, getOrder, giftAccess, handleProviderWebhook, listGifts, listOrders, listOrgOrders, listProducts, markPaidManual, orderReceipt, paymentsReconciliation, paymentsStats, providersOverview, recheckOrder, revokeEntitlement, startCheckout, upsertPrice } from "./payments.service.js";

function handle(reply: FastifyReply, err: unknown) {
  if (err instanceof PaymentError || err instanceof ProviderError) {
    return reply.status(err.statusCode).send({ error: err.code, message: err.message });
  }
  throw err;
}

/** Corps brut conservé par les parseurs d'app.ts (signature HMAC des webhooks). */
function rawBodyOf(req: FastifyRequest): string {
  return (req as unknown as { rawBody?: string }).rawBody ?? "";
}

export async function paymentRoutes(app: FastifyInstance) {
  // --- produits & prix (outillage staff minimal du socle ; admin complet : PAY-2)
  app.get("/payments/products", { preHandler: authenticate }, async () => ({ data: await listProducts() }));

  app.post("/payments/products", { preHandler: guard("order:manage") }, async (req, reply) => {
    const body = z.object({
      type: z.enum(["COURSE", "SEATS"]),
      title: z.string().min(1).max(200),
      courseId: z.string().optional(),
      seatCount: z.number().int().positive().optional(),
    }).parse(req.body);
    try { return reply.status(201).send({ data: await createProduct(body) }); } catch (err) { return handle(reply, err); }
  });

  app.put("/payments/products/:id/prices/:currency", { preHandler: guard("order:manage") }, async (req, reply) => {
    const { id, currency } = z.object({ id: z.string(), currency: z.string() }).parse(req.params);
    const { amountMajor } = z.object({ amountMajor: z.union([z.string(), z.number()]) }).parse(req.body);
    try { return { data: await upsertPrice(id, currency, amountMajor) }; } catch (err) { return handle(reply, err); }
  });

  // --- commandes -----------------------------------------------------------------
  app.post("/payments/orders", { preHandler: authenticate }, async (req, reply) => {
    const body = z.object({
      productId: z.string(),
      currency: z.string(),
      buyerOrgId: z.string().optional(),
      quantity: z.number().int().optional(),
    }).parse(req.body);
    try {
      const { order, reused } = await createOrder(req.principal!, body);
      return reply.status(reused ? 200 : 201).send({ data: order, reused });
    } catch (err) { return handle(reply, err); }
  });

  app.get("/payments/orders", { preHandler: guard("order:read") }, async (req) => {
    const { status } = z.object({ status: z.enum(["PENDING", "PAID", "FAILED"]).optional() }).parse(req.query ?? {});
    return { data: await listOrders(status) };
  });

  // Commandes d'une organisation (portail entreprise, PAY-3) — admins de l'org.
  app.get("/payments/organizations/:orgId/orders", { preHandler: authenticate }, async (req, reply) => {
    const { orgId } = z.object({ orgId: z.string() }).parse(req.params);
    try { return { data: await listOrgOrders(req.principal!, orgId) }; } catch (err) { return handle(reply, err); }
  });

  app.get("/payments/orders/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await getOrder(req.principal!, id) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/payments/orders/:id/checkout", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await startCheckout(req.principal!, id) }; } catch (err) { return handle(reply, err); }
  });

  // Constat staff d'un règlement `manual` (virement reçu) — référence obligatoire.
  app.post("/payments/orders/:id/mark-paid", { preHandler: guard("order:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { reference } = z.object({ reference: z.string().min(3).max(120) }).parse(req.body);
    try { return { data: await markPaidManual(req.principal!, id, reference) }; } catch (err) { return handle(reply, err); }
  });

  // --- catalogue d'achat (écran d'achat PWA) ---------------------------------------
  app.get("/payments/catalog/:courseId", { preHandler: authenticate }, async (req) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    return { data: await courseCatalog(courseId, req.principal!.id) };
  });

  // --- reçu PDF (commande réglée — acheteur ou staff) ------------------------------
  app.get("/payments/orders/:id/receipt.pdf", { preHandler: authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      const pdf = await orderReceipt(req.principal!, id);
      return reply.header("content-type", "application/pdf")
        .header("content-disposition", `inline; filename="recu-${id}.pdf"`).send(pdf);
    } catch (err) { return handle(reply, err); }
  });

  // --- « Offrir l'accès » (Super Admin uniquement — Q4) ----------------------------
  app.post("/payments/gifts", { preHandler: guard("entitlement:gift") }, async (req, reply) => {
    const body = z.object({ productId: z.string(), email: z.string().email().optional(), organizationId: z.string().optional() }).parse(req.body);
    try { return reply.status(201).send({ data: await giftAccess(req.principal!, body) }); } catch (err) { return handle(reply, err); }
  });

  app.get("/payments/gifts", { preHandler: guard("entitlement:gift") }, async () => ({ data: await listGifts() }));

  app.delete("/payments/entitlements/:id", { preHandler: guard("entitlement:gift") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await revokeEntitlement(req.principal!, id) }; } catch (err) { return handle(reply, err); }
  });

  // --- console paiements (PAY-4) ----------------------------------------------------
  // Override « Re-vérifier » : interroge le fournisseur (fetchStatus) et applique
  // la vérité obtenue — le filet quand un webhook s'est perdu.
  app.post("/payments/orders/:id/recheck", { preHandler: guard("order:manage") }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try { return { data: await recheckOrder(req.principal!, id) }; } catch (err) { return handle(reply, err); }
  });

  app.get("/payments/reconciliation", { preHandler: guard("order:read") }, async () => ({ data: await paymentsReconciliation() }));

  app.get("/payments/stats", { preHandler: guard("order:read") }, async (req) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).parse(req.query ?? {});
    return { data: await paymentsStats(days) };
  });

  // --- fournisseurs ----------------------------------------------------------------
  app.get("/payments/providers", { preHandler: guard("order:read") }, async () => ({ data: await providersOverview() }));

  // --- tunnel d'achat invité (PAY-2bis) : routes PUBLIQUES — e-mail seul champ.
  // Rate-limit strict (même cap que l'auth) : anti-spam d'e-mails et
  // anti-énumération ; le suivi/reçu exige le jeton de commande scellé.
  const guestLimit = { config: { rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, timeWindow: "1 minute" } } };

  app.get("/payments/guest/course/:courseId", async (req, reply) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params);
    try { return { data: await guestCourseInfo(courseId) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/payments/guest/checkout", guestLimit, async (req, reply) => {
    const body = z.object({ courseId: z.string(), currency: z.string(), email: z.string().email().max(254) }).parse(req.body);
    try { return reply.status(201).send({ data: await guestCheckout(body, req.ip) }); } catch (err) { return handle(reply, err); }
  });

  app.get("/payments/guest/orders/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { t } = z.object({ t: z.string() }).parse(req.query ?? {});
    try { return { data: await guestGetOrder(id, t) }; } catch (err) { return handle(reply, err); }
  });

  app.post("/payments/guest/orders/:id/checkout", guestLimit, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { t } = z.object({ t: z.string() }).parse(req.body ?? {});
    try { return { data: await guestResumeCheckout(id, t) }; } catch (err) { return handle(reply, err); }
  });

  app.get("/payments/guest/orders/:id/receipt.pdf", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { t } = z.object({ t: z.string() }).parse(req.query ?? {});
    try {
      const pdf = await guestReceipt(id, t);
      return reply.header("content-type", "application/pdf")
        .header("content-disposition", `inline; filename="recu-${id}.pdf"`).send(pdf);
    } catch (err) { return handle(reply, err); }
  });

  // --- webhooks publics (pas d'auth : la sécurité EST la signature + le check) ----
  for (const key of ["cinetpay", "flutterwave"] as const) {
    app.post(`/payments/webhooks/${key}`, async (req, reply) => {
      const out = await handleProviderWebhook(key, req.headers, rawBodyOf(req), req.ip);
      return reply.status(out.httpStatus).send(out.body);
    });
  }
}
