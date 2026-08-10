/**
 * accreditations.service.ts — registre d'habilitation des évaluateurs
 * (socle commun d'évaluation v1.1, §9.2).
 *
 * « Aucun évaluateur ne note un dossier réel avant d'avoir passé ce test. »
 * L'habilitation s'obtient par calibration sur les dossiers de référence
 * (écart ≤ 8 points par dossier, aucun critère à plus d'une bande), vaut
 * 12 mois PAR PARCOURS, et se refait après toute révision de la grille.
 * L'historique est conservé : une ligne par octroi, révocation datée.
 */
import { prisma } from "../../db/prisma.js";
import { hasPermission } from "../../domain/auth/permissions.js";

export class AccreditationError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

export const ACCREDITATION_MONTHS = 12;

/** L'habilitation ACTIVE d'un évaluateur sur un parcours (la plus récente
 *  non révoquée et non expirée), ou null. */
export async function activeAccreditation(evaluatorId: string, courseId: string) {
  return prisma.evaluatorAccreditation.findFirst({
    where: { evaluatorId, courseId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { grantedAt: "desc" },
  });
}

/** Évaluateurs détenant une habilitation active sur un parcours. */
export async function accreditedEvaluatorIds(courseId: string): Promise<string[]> {
  const rows = await prisma.evaluatorAccreditation.findMany({
    where: { courseId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { evaluatorId: true }, distinct: ["evaluatorId"],
  });
  return rows.map((r) => r.evaluatorId);
}

/** Registre complet (admin) — statut calculé par ligne. */
export async function listAccreditations() {
  const rows = await prisma.evaluatorAccreditation.findMany({
    orderBy: { grantedAt: "desc" },
    include: {
      evaluator: { select: { id: true, name: true, email: true, role: true } },
      course: { select: { id: true, slug: true } },
      grantedBy: { select: { id: true, name: true } },
    },
  });
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    evaluator: r.evaluator,
    course: r.course,
    grantedAt: r.grantedAt,
    expiresAt: r.expiresAt,
    grantedBy: r.grantedBy,
    notes: r.notes,
    revokedAt: r.revokedAt,
    status: r.revokedAt ? "revoked" : r.expiresAt.getTime() <= now ? "expired" : "active",
  }));
}

/** Octroi (direction pédagogique) : 12 mois, notes de calibration conservées. */
export async function grantAccreditation(evaluatorId: string, courseId: string, grantedById: string, notes?: string) {
  const evaluator = await prisma.user.findUnique({ where: { id: evaluatorId } });
  if (!evaluator) throw new AccreditationError(404, "no_evaluator", "Évaluateur introuvable");
  if (!hasPermission(evaluator.role, "evaluation:grade")) {
    throw new AccreditationError(422, "not_evaluator", `${evaluator.name} ne peut pas évaluer (rôle ${evaluator.role})`);
  }
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AccreditationError(404, "no_course", "Parcours introuvable");
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + ACCREDITATION_MONTHS);
  return prisma.evaluatorAccreditation.create({
    data: { evaluatorId, courseId, grantedById, notes: notes?.trim() || null, expiresAt },
    include: { evaluator: { select: { id: true, name: true } }, course: { select: { id: true, slug: true } } },
  });
}

/** Révocation datée (l'historique reste). */
export async function revokeAccreditation(id: string) {
  const row = await prisma.evaluatorAccreditation.findUnique({ where: { id } });
  if (!row) throw new AccreditationError(404, "not_found", "Habilitation introuvable");
  if (row.revokedAt) throw new AccreditationError(409, "already_revoked", "Habilitation déjà révoquée");
  return prisma.evaluatorAccreditation.update({ where: { id }, data: { revokedAt: new Date() } });
}
