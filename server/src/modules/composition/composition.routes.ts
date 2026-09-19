/**
 * composition.routes.ts — restitution d'OBSERVATION du dispositif
 * d'authenticité (avenant n°1, objet F). Directeur Pédagogique seul
 * (permission composition:observe, détenue par SUPER_ADMIN uniquement) :
 * l'évaluateur n'a accès à rien, jamais (annexe §7). L'accès est journalisé
 * (annexe §7 : « accès aux compteurs pour maintenance, journalisé »).
 */
import type { FastifyInstance } from "fastify";
import { authenticate, authorize } from "../../lib/auth.js";
import { audit } from "../../lib/audit.js";
import { observationDistribution } from "./composition.service.js";

export async function compositionRoutes(app: FastifyInstance) {
  app.get("/composition/observation", { preHandler: [authenticate, authorize("composition:observe")] }, async (req) => {
    await audit({ actorId: req.principal!.id, action: "composition.observation.read", ip: req.ip });
    return { data: await observationDistribution() };
  });
}
