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

/** One-time verification code (B2C signup / sensitive actions). */
export function otpMessage(code: string, minutes = 10): Message {
  const body = `Votre code de vérification ${env.BRAND_NAME} est : ${code}\nIl expire dans ${minutes} minutes.\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`;
  const mobileBody = `${env.BRAND_NAME} : code ${code} (valide ${minutes} min).`;
  return { subject: `Votre code de vérification ${env.BRAND_NAME}`, body, mobileBody };
}
