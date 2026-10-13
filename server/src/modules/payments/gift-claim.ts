/**
 * gift-claim.ts — rattachement des invitations « parcours offert ».
 *
 * Un cadeau vers un e-mail SANS compte ne crée jamais le compte (RGPD) : il
 * pose un droit GIFT en attente (Entitlement.pendingEmail, sans titulaire).
 * Quand la personne crée son compte ELLE-MÊME — inscription standard avec
 * consentements CGU/confidentialité, ou tunnel d'achat invité — ce module lui
 * rattache les droits en attente portant son e-mail.
 *
 * Module volontairement minimal (prisma + audit) : il est appelé depuis
 * auth.service (inscription) sans créer de cycle avec payments.service.
 */
import { prisma } from "../../db/prisma.js";
import { audit } from "../../lib/audit.js";

/** Rattache à `userId` les droits GIFT en attente pour `email` (non révoqués).
 *  Retourne le nombre de droits activés. Idempotent et silencieux (0 si rien). */
export async function claimGiftInvites(userId: string, email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const pending = await prisma.entitlement.findMany({
    where: { pendingEmail: normalized, revokedAt: null, holderUserId: null },
    select: { id: true, courseId: true },
  });
  if (pending.length === 0) return 0;
  await prisma.entitlement.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { holderUserId: userId, pendingEmail: null },
  });
  for (const p of pending) {
    await audit({ actorId: userId, action: "entitlement.gift.claimed", targetType: "Entitlement", targetId: p.id, meta: { email: normalized, courseId: p.courseId } });
  }
  return pending.length;
}
