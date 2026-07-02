/**
 * devices.service.ts — push device registry (P4 brick 2).
 *
 * The native app registers its push token here; the notification dispatcher
 * resolves a recipient's tokens and forwards them to the push gateway
 * (PUSH_WEBHOOK_URL) so a client FCM/APNs sender can target the right devices.
 */
import { prisma } from "../../db/prisma.js";

const PLATFORMS = ["ios", "android", "web"];

export async function registerDevice(userId: string, token: string, platform: string) {
  const plat = PLATFORMS.includes(platform) ? platform : "unknown";
  return prisma.device.upsert({
    where: { token },
    update: { userId, platform: plat, lastSeenAt: new Date() },
    create: { userId, token, platform: plat },
  });
}

/** Unregister a device — scoped to its owner so a caller can't drop another
 *  user's device by guessing/knowing its token. */
export async function removeDevice(userId: string, token: string) {
  const r = await prisma.device.deleteMany({ where: { token, userId } });
  return { token, removed: r.count };
}

/** Push tokens for a recipient identified by user id OR e-mail (the notification
 *  `recipient` field can be either). */
export async function tokensForRecipient(recipient: string): Promise<string[]> {
  const devices = await prisma.device.findMany({
    where: { user: { OR: [{ id: recipient }, { email: recipient }] } },
    select: { token: true },
  });
  return devices.map((d) => d.token);
}
