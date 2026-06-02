/**
 * audit.ts — append-only security audit trail.
 *
 * Fire-and-forget: auditing must never break or slow the request path, so write
 * failures are logged and swallowed.
 */
import { prisma } from "../db/prisma.js";

export type AuditEvent = {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  meta?: Record<string, unknown>;
};

export async function audit(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: event.actorId ?? null,
        action: event.action,
        targetType: event.targetType ?? null,
        targetId: event.targetId ?? null,
        ip: event.ip ?? null,
        meta: (event.meta ?? undefined) as object | undefined,
      },
    });
  } catch (e) {
    console.error("[audit] write failed:", e instanceof Error ? e.message : e);
  }
}
