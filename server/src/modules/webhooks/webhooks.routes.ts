import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  WEBHOOK_EVENTS, createWebhook, deleteWebhook, listDeliveries, listWebhooks, updateWebhook,
} from "./webhooks.service.js";
import { guard } from "../../lib/auth.js";
import { audit } from "../../lib/audit.js";

const eventEnum = z.enum(WEBHOOK_EVENTS as [string, ...string[]]);

export async function webhookRoutes(app: FastifyInstance) {
  // List subscriptions (admin). Optional ?organizationId filter.
  app.get("/webhooks", { preHandler: guard("org:manage") }, async (req) => {
    const { organizationId } = z.object({ organizationId: z.string().optional() }).parse(req.query ?? {});
    return { data: await listWebhooks(organizationId) };
  });

  // Register a subscription. Returns the signing secret once.
  app.post("/webhooks", { preHandler: guard("org:manage") }, async (req, reply) => {
    const body = z.object({
      url: z.string().url(),
      events: z.array(eventEnum).min(1),
      organizationId: z.string().nullish(),
      secret: z.string().min(16).optional(),
    }).parse(req.body);
    const hook = await createWebhook({ url: body.url, events: body.events as never, organizationId: body.organizationId ?? null, secret: body.secret });
    await audit({ actorId: req.principal!.id, action: "webhook.create", targetType: "Webhook", targetId: hook.id, ip: req.ip, meta: { events: body.events } });
    return reply.status(201).send({ data: hook });
  });

  // Update (toggle active / change url or events).
  app.patch("/webhooks/:id", { preHandler: guard("org:manage") }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const patch = z.object({
      url: z.string().url().optional(),
      events: z.array(eventEnum).min(1).optional(),
      active: z.boolean().optional(),
    }).parse(req.body);
    return { data: await updateWebhook(id, patch as never) };
  });

  app.delete("/webhooks/:id", { preHandler: guard("org:manage") }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await audit({ actorId: req.principal!.id, action: "webhook.delete", targetType: "Webhook", targetId: id, ip: req.ip });
    return { data: await deleteWebhook(id) };
  });

  // Delivery log for a subscription (debugging integrations).
  app.get("/webhooks/:id/deliveries", { preHandler: guard("org:manage") }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return { data: await listDeliveries(id) };
  });
}
