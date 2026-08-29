/**
 * notify/templates.ts — copy for transactional messages (pure, testable).
 * Used by B2B invitations and B2C verification. French, mobile-friendly.
 */
import { env } from "../../config/env.js";

const appUrl = () => (env.APP_BASE_URL ?? "").replace(/\/+$/, "");

export type Message = { subject: string; body: string; mobileBody: string };

/** Invitation for an org-provisioned learner (B6). */
export function invitationMessage(p: { name: string; orgName: string; email: string; tempPassword?: string }): Message {
  const link = appUrl() || "votre plateforme de formation";
  const access = p.tempPassword
    ? `Mot de passe provisoire : ${p.tempPassword}`
    : `Définissez votre mot de passe via « Mot de passe oublié ».`;
  const body = [
    `Bonjour ${p.name},`,
    ``,
    `${p.orgName} vous a inscrit·e à la plateforme ${env.BRAND_NAME}.`,
    ``,
    `Connexion : ${link}`,
    `Identifiant : ${p.email}`,
    access,
    ``,
    `Bonne formation !`,
  ].join("\n");
  const mobileBody = `${env.BRAND_NAME} — ${p.orgName} vous a inscrit·e. Connexion : ${link} · identifiant ${p.email}${p.tempPassword ? ` · mdp ${p.tempPassword}` : ""}`;
  return { subject: `Votre accès ${env.BRAND_NAME} — ${p.orgName}`, body, mobileBody };
}

/**
 * Relance J+3/7/14 (retours de test, P2) : le nudge (IA ou gabarit) arrivait
 * brut, sans salutation ni lien — l'apprenant ne savait pas où cliquer. On
 * l'enveloppe : bonjour, corps, LIEN DIRECT vers la formation (la PWA reprend
 * automatiquement là où l'apprenant s'est arrêté), signature.
 */
export function reengagementMessage(p: { stage: "J3" | "J7" | "J14"; learnerName: string; nudge: string; admin?: boolean; link?: string }): Message {
  const link = p.link ?? appUrl();
  if (p.admin) {
    const body = [`Bonjour,`, ``, p.nudge, ``, `— ${env.BRAND_NAME}`].join("\n");
    return { subject: `${env.BRAND_NAME} — apprenant inactif depuis 14 jours`, body, mobileBody: p.nudge };
  }
  const subject =
    p.stage === "J3" ? `${p.learnerName}, votre parcours vous attend`
    : p.stage === "J7" ? `15 minutes pour reprendre votre formation ?`
    : `On ne vous oublie pas — reprenez à votre rythme`;
  const body = [
    `Bonjour ${p.learnerName},`,
    ``,
    p.nudge,
    ``,
    ...(link ? [`👉 Reprendre ma formation : ${link}`, `(vous reprendrez exactement là où vous vous êtes arrêté·e)`, ``] : []),
    `Bonne reprise !`,
    `L'équipe ${env.BRAND_NAME}`,
  ].join("\n");
  const mobileBody = link ? `${p.nudge} 👉 ${link}` : p.nudge;
  return { subject, body, mobileBody };
}

/** One-time verification code (B2C signup / sensitive actions). */
export function otpMessage(code: string, minutes = 10): Message {
  const body = `Votre code de vérification ${env.BRAND_NAME} est : ${code}\nIl expire dans ${minutes} minutes.\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`;
  const mobileBody = `${env.BRAND_NAME} : code ${code} (valide ${minutes} min).`;
  return { subject: `Votre code de vérification ${env.BRAND_NAME}`, body, mobileBody };
}
