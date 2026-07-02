/**
 * auth.ts — authentication + authorization preHandlers.
 *
 * Identity (dev-grade): the acting principal is taken from the `x-user-id`
 * header and resolved to a User. Wiring a real IdP / JWT is a later concern; the
 * authorization layer below is the deliverable and is transport-agnostic.
 */
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { Role } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { authDevHeader, oidcEnabled } from "../config/env.js";
import { hasPermission, isStaff, type Permission } from "../domain/auth/permissions.js";
import { verifyAccessToken } from "./auth/jwt.js";
import { verifyExternalToken } from "./auth/oidc.js";

export type Principal = { id: string; role: Role; name: string };

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}

async function principalById(id: string): Promise<Principal | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? { id: user.id, role: user.role, name: user.name } : null;
}

/** Map a verified external (OIDC) token to a local principal; JIT-provision if enabled. */
async function principalFromExternal(payload: Record<string, unknown>): Promise<Principal | null> {
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!email) return null;
  const emailVerified = payload.email_verified === true;
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    // Never let an external token adopt a privileged or locally-credentialed
    // account by e-mail match — those require explicit linking (privilege-escalation guard).
    if (isStaff(user.role) || user.passwordHash) return null;
  } else {
    const { env } = await import("../config/env.js");
    // Only JIT-provision when the IdP asserts the e-mail is verified.
    if (!env.OIDC_JIT_PROVISION || !emailVerified) return null;
    user = await prisma.user.create({
      data: { email, name: typeof payload.name === "string" ? payload.name : email, role: "LEARNER" },
    });
  }
  return { id: user.id, role: user.role, name: user.name };
}

/**
 * Resolve the principal from a Bearer JWT — first-party access token, else an
 * external IdP token (when OIDC is configured). A dev-only `x-user-id` header is
 * accepted when `authDevHeader` is on (never in production). 401 otherwise.
 */
export const authenticate: preHandlerHookHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const header = req.headers["authorization"];
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    // 1) first-party access token
    try {
      const payload = await verifyAccessToken(token);
      const principal = payload.sub ? await principalById(payload.sub) : null;
      if (principal) { req.principal = principal; return; }
    } catch { /* fall through to OIDC */ }
    // 2) external IdP token
    if (oidcEnabled) {
      try {
        const payload = await verifyExternalToken(token);
        const principal = await principalFromExternal(payload);
        if (principal) { req.principal = principal; return; }
      } catch { /* fall through to 401 */ }
    }
    return reply.status(401).send({ error: "unauthenticated", message: "Jeton invalide ou expiré" });
  }

  // dev-only escape hatch
  if (authDevHeader) {
    const userId = req.headers["x-user-id"];
    if (typeof userId === "string" && userId.length > 0) {
      const principal = await principalById(userId);
      if (principal) { req.principal = principal; return; }
      return reply.status(401).send({ error: "unauthenticated", message: "Principal inconnu" });
    }
  }
  return reply.status(401).send({ error: "unauthenticated", message: "Authentification requise (Bearer)" });
};

/** Require the principal's role to grant every listed permission (401 then 403). */
export function authorize(...permissions: Permission[]): preHandlerHookHandler {
  return async (req, reply) => {
    if (!req.principal) {
      return reply.status(401).send({ error: "unauthenticated", message: "Authentification requise" });
    }
    const missing = permissions.filter((p) => !hasPermission(req.principal!.role, p));
    if (missing.length > 0) {
      return reply.status(403).send({
        error: "forbidden",
        message: `Rôle ${req.principal.role} insuffisant`,
        missing,
      });
    }
  };
}

/** Compose authenticate + authorize into a single preHandler array. */
export function guard(...permissions: Permission[]): preHandlerHookHandler[] {
  return [authenticate, authorize(...permissions)];
}

/**
 * Enrolment ownership: the principal must own the enrolment (:id param) or be
 * staff. Used to protect learner-scoped runtime actions.
 */
export const requireEnrollmentAccess: preHandlerHookHandler = async (req, reply) => {
  if (!req.principal) {
    return reply.status(401).send({ error: "unauthenticated", message: "Authentification requise" });
  }
  const { id } = req.params as { id?: string };
  if (!id) return reply.status(400).send({ error: "bad_request", message: "id d'inscription manquant" });
  const enrollment = await prisma.enrollment.findUnique({ where: { id }, select: { userId: true } });
  if (!enrollment) return reply.status(404).send({ error: "not_found", message: "Inscription introuvable" });
  if (enrollment.userId !== req.principal.id && !isStaff(req.principal.role)) {
    return reply.status(403).send({ error: "forbidden", message: "Accès réservé au propriétaire de l'inscription" });
  }
};
