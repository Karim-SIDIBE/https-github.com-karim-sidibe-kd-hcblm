/**
 * badges.ts — badge type per block + personalized, PAM-anchored messages.
 *
 * The spec requires that each end-of-block badge carries a "message personnalisé
 * ancré dans le Moment d'Ancrage" and that the progress peer is notified.
 */
import type { Block } from "../content-model.js";

export type BadgeTypeName = "ENTRY" | "COMPREHENSION" | "PRACTICE" | "ANCHORING" | "CERTIFICATE";

const BLOCK_BADGE: Record<Block["type"], BadgeTypeName> = {
  ONBOARDING: "ENTRY",
  COMPREHENSION: "COMPREHENSION",
  PRACTICE: "PRACTICE",
  ANCHORING: "ANCHORING",
  CERTIFICATION: "CERTIFICATE",
};

export function badgeTypeForBlock(type: Block["type"]): BadgeTypeName {
  return BLOCK_BADGE[type];
}

/** A short PAM-anchored congratulation, per badge. */
export function badgeMessage(
  badgeType: BadgeTypeName,
  badgeLabel: string,
  momentAncrage: string | null | undefined,
): string {
  const pam = (momentAncrage ?? "").trim();
  const anchor = pam.length > 0
    ? `Souvenez-vous de ce que vous aviez écrit : « ${pam} »`
    : "Souvenez-vous de la situation que vous aviez décrite au Bloc 0.";

  const tail: Record<BadgeTypeName, string> = {
    ENTRY: "Vous venez de poser le premier jalon de votre reprise de contrôle.",
    COMPREHENSION: "Vous comprenez désormais les dynamiques du temps dans votre contexte africain.",
    PRACTICE: "Vous avez mis vos outils à l'épreuve du terrain.",
    ANCHORING: "Vos habitudes commencent à tenir — c'est l'ancrage durable.",
    CERTIFICATE: "Vous avez démontré votre maîtrise. Félicitations pour votre certification de Niveau 1 !",
  };

  return `🏅 ${badgeLabel} débloqué ! ${anchor} ${tail[badgeType]}`;
}

/** Peer notification text (Pilier 6.3). */
export function peerNotificationText(peerName: string | null | undefined, learnerName: string, badgeLabel: string): string {
  const who = peerName?.trim() || "Cher pair de progression";
  return `${who}, ${learnerName} vient d'obtenir le « ${badgeLabel} » dans son parcours de gestion du temps. Un mot d'encouragement ferait la différence.`;
}
