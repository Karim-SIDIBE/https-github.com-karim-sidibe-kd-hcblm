/**
 * payments.routes.ts — surface HTTP du socle paiement (PAY-1).
 * La logique vit dans payments.service ; ici : validation Zod, gardes RBAC,
 * et les DEUX endpoints webhook publics (toujours ouverts, chacun vérifié
 * avec la clé de SON fournisseur — spec §09).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticate, guard } from "../../lib/auth.js";
import { ProviderError } from "../../lib/payments/provider.js";
import { PaymentError, createOrder, createProduct, getOrder, handleProviderWebhook, listProducts, markPaidManual, providersOverview, startCheckout, upsertPrice } from "./payments.service.js";

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

  // --- fournisseurs ----------------------------------------------------------------
  app.get("/payments/providers", { preHandler: guard("order:read") }, async () => ({ data: await providersOverview() }));

  // --- webhooks publics (pas d'auth : la sécurité EST la signature + le check) ----
  for (const key of ["cinetpay", "flutterwave"] as const) {
    app.post(`/payments/webhooks/${key}`, async (req, reply) => {
      const out = await handleProviderWebhook(key, req.headers, rawBodyOf(req), req.ip);
      return reply.status(out.httpStatus).send(out.body);
    });
  }
}
