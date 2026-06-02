import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runReEngagement, runJournalTriggers, runProjectSlaAlerts } from "./jobs.service.js";
import { dispatchPending } from "../notifications/notifications.service.js";
import { forwardPending } from "../../lib/lrs/forwarder.js";
import { guard } from "../../lib/auth.js";

export async function jobRoutes(app: FastifyInstance) {
  // Run the inactivity scan. `now` (ISO) optional — useful for testing.
  app.post("/jobs/re-engagement/run", { preHandler: guard("job:run") }, async (req) => {
    const { now } = z.object({ now: z.string().datetime().optional() }).parse(req.body ?? {});
    return { data: await runReEngagement(now ? new Date(now) : new Date()) };
  });

  // Deliver pending notifications.
  app.post("/jobs/notifications/dispatch", { preHandler: guard("job:run") }, async (req) => {
    const { batchSize } = z.object({ batchSize: z.number().int().positive().max(500).optional() }).parse(req.body ?? {});
    return { data: await dispatchPending(batchSize ?? 100) };
  });

  // Fire due journal prompts (Day+1/+3/+5/+7/+10/+14 from block start).
  app.post("/jobs/journal-triggers/run", { preHandler: guard("job:run") }, async (req) => {
    const { now } = z.object({ now: z.string().datetime().optional() }).parse(req.body ?? {});
    return { data: await runJournalTriggers(now ? new Date(now) : new Date()) };
  });

  // Bloc 4 SLA: alert admin for projects unevaluated after 5 business days.
  app.post("/jobs/project-sla/run", { preHandler: guard("job:run") }, async (req) => {
    const { now } = z.object({ now: z.string().datetime().optional() }).parse(req.body ?? {});
    return { data: await runProjectSlaAlerts(now ? new Date(now) : new Date()) };
  });

  // Forward stored xAPI statements to the external LRS.
  app.post("/jobs/lrs/forward", { preHandler: guard("job:run") }, async (req) => {
    const { batchSize } = z.object({ batchSize: z.number().int().positive().max(500).optional() }).parse(req.body ?? {});
    return { data: await forwardPending(batchSize ?? 100) };
  });
}
