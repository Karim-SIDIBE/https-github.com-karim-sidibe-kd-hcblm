/**
 * lrs/forwarder.ts — forward stored xAPI statements to an external LRS.
 *
 * Standard xAPI: POST a statement array to `${LRS_ENDPOINT}/statements` with
 * Basic auth and the `X-Experience-API-Version` header. Unset endpoint → no-op
 * (statements stay pending). Idempotent via the `forwarded` flag.
 */
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";

export type ForwardResult = { pending: number; forwarded: number; failed: number; skipped?: boolean };

export async function forwardPending(batchSize = 100): Promise<ForwardResult> {
  const pending = await prisma.xapiStatement.findMany({
    where: { forwarded: false },
    orderBy: { storedAt: "asc" },
    take: batchSize,
  });

  if (!env.LRS_ENDPOINT) {
    return { pending: pending.length, forwarded: 0, failed: 0, skipped: true };
  }
  if (pending.length === 0) return { pending: 0, forwarded: 0, failed: 0 };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "X-Experience-API-Version": "1.0.3",
  };
  if (env.LRS_KEY) {
    const basic = Buffer.from(`${env.LRS_KEY}:${env.LRS_SECRET ?? ""}`).toString("base64");
    headers.authorization = `Basic ${basic}`;
  }

  let forwarded = 0;
  let failed = 0;
  // Send one-by-one so a single bad statement doesn't fail the whole batch.
  for (const row of pending) {
    try {
      const res = await fetch(`${env.LRS_ENDPOINT}/statements`, {
        method: "POST",
        headers,
        body: JSON.stringify([row.statement]),
      });
      if (!res.ok) throw new Error(`LRS ${res.status}`);
      await prisma.xapiStatement.update({
        where: { id: row.id },
        data: { forwarded: true, forwardedAt: new Date(), forwardError: null },
      });
      forwarded++;
    } catch (e) {
      failed++;
      await prisma.xapiStatement.update({
        where: { id: row.id },
        data: { forwardError: e instanceof Error ? e.message : "forward error" },
      });
    }
  }
  return { pending: pending.length, forwarded, failed };
}
