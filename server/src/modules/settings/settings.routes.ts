/**
 * settings.routes.ts — platform-wide settings (key → JSON value).
 *
 * First use: the staff-2FA policy ("require_staff_2fa"). Reading is open to
 * any authenticated user (the SPA needs it to steer people to enrolment);
 * writing is SUPER_ADMIN only and audited.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { authenticate, guard } from "../../lib/auth.js";
import { audit } from "../../lib/audit.js";

/** Whitelisted keys and their value schema — no free-form writes. */
const KNOWN = {
  require_staff_2fa: z.boolean(),
  /// Fournisseur de paiement ACTIF pour les nouveaux checkouts (spec paiement
  /// §09) — bascule Super Admin sans redéploiement ; les webhooks des deux
  /// agrégateurs restent toujours acceptés. Défaut : « manual » (aucun compte
  /// marchand requis).
  payment_provider: z.enum(["manual", "cinetpay", "flutterwave"]),
  /// Mentions légales imprimées en pied des reçus PDF (PAY-4) : n° contribuable,
  /// RCCM, régime de TVA… Texte libre multi-lignes, rédigé par le Super Admin.
  receipt_legal: z.string().max(2000),
} as const;
type SettingKey = keyof typeof KNOWN;
const keyEnum = z.enum(Object.keys(KNOWN) as [SettingKey, ...SettingKey[]]);

const DEFAULTS: Record<SettingKey, unknown> = { require_staff_2fa: false, payment_provider: "manual", receipt_legal: "" };

export async function getSetting<T>(key: SettingKey): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return (row ? row.value : DEFAULTS[key]) as T;
}

/** Roles the 2FA policy applies to: the console's privileged roles. */
export const POLICY_2FA_ROLES = ["SUPER_ADMIN", "COURSE_ADMIN"] as const;

export async function settingsRoutes(app: FastifyInstance) {
  // All settings (defaults merged) — any authenticated user.
  app.get("/settings", { preHandler: authenticate }, async () => {
    const rows = await prisma.setting.findMany();
    const map: Record<string, unknown> = { ...DEFAULTS };
    for (const r of rows) if (r.key in KNOWN) map[r.key] = r.value;
    return { data: map };
  });

  // Change one setting — SUPER_ADMIN only, audited.
  app.put("/settings/:key", { preHandler: guard("user:manage") }, async (req, reply) => {
    if (req.principal!.role !== "SUPER_ADMIN") {
      return reply.status(403).send({ error: "forbidden", message: "Réservé au super-administrateur" });
    }
    const { key } = z.object({ key: keyEnum }).parse(req.params);
    const { value } = z.object({ value: z.unknown() }).parse(req.body);
    const parsed = KNOWN[key].parse(value);
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: parsed as never, updatedById: req.principal!.id },
      update: { value: parsed as never, updatedById: req.principal!.id },
    });
    await audit({ actorId: req.principal!.id, action: "setting.update", targetType: "Setting", targetId: key, ip: req.ip, meta: { value: parsed } });
    return { data: { key, value: parsed } };
  });
}
