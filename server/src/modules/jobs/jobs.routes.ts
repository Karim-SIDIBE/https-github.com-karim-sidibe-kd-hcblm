import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runReEngagement } from "./jobs.service.js";
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

  // Forward stored xAPI statements to the external LRS.
  app.post("/jobs/lrs/forward", { preHandler: guard("job:run") }, async (req) => {
    const { batchSize } = z.object({ batchSize: z.number().int().positive().max(500).optional() }).parse(req.body ?? {});
    return { data: await forwardPending(batchSize ?? 100) };
  });
}
