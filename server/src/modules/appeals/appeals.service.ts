/**
 * appeals.service.ts — procédure de recours (socle §10) et surveillance
 * continue par double notation (socle §9.3).
 *
 * Recours : contestation écrite du candidat sous 15 jours calendaires →
 * second évaluateur À L'AVEUGLE (n'a pas participé à la première notation,
 * ne reçoit jamais les scores attribués) → écart < 10 : la moyenne fait foi ;
 * ≥ 10 : un troisième évaluateur tranche → décision finale appliquée et
 * notifiée, motivée critère par critère. La table Appeal EST le registre.
 *
 * QC : 1 dossier noté sur 10 (sélection automatique à la notation) + ajouts
 * manuels ; la note officielle ne change jamais — les écarts alimentent la
 * médiane trimestrielle et les incidents (> 15 pts, tranché par un tiers).
 */
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { CourseContent } from "../../domain/content-model.js";
import {
  APPEAL_ASSIGN_BUSINESS_DAYS, APPEAL_GRADE_BUSINESS_DAYS, APPEAL_NOTIFY_BUSINESS_DAYS,
  addBusinessDays, appealWindowOpen, qcSummary, resolveAppeal,
} from "../../domain/engine/appeal.js";
import { activeAccreditation } from "../accreditations/accreditations.service.js";
import { recordRubricEvaluation } from "../enrollments/enrollments.service.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import { audit } from "../../lib/audit.js";

const ADMIN_EMAIL = "admin@kompetences.net";

export class AppealError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

type RubricCriterion = { label: string; weightPoints: number; bands?: unknown[] };

async function loadCtx(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { user: true, courseVersion: true, projectSubmission: true },
  });
  if (!enrollment) throw new AppealError(404, "not_found", "Inscription introuvable");
  const submission = enrollment.projectSubmission;
  if (!submission) throw new AppealError(404, "no_submission", "Aucun projet soumis");
  const content = CourseContent.parse(enrollment.courseVersion.content);
  const cert = content.blocks.find((b) => b.type === "CERTIFICATION");
  if (cert?.type !== "CERTIFICATION") throw new AppealError(409, "no_block", "Bloc 4 absent");
  const criteria = cert.payload.rubric.criteria as unknown as RubricCriterion[];
  return { enrollment, submission, criteria };
}

/** Notation aveugle : valide les points/preuves contre la grille — sans jamais
 *  renvoyer quoi que ce soit de la première notation. */
function validateBlindScores(
  criteria: RubricCriterion[],
  input: { index?: number; label?: string; points: number; evidence?: string }[],
) {
  const banded = criteria.some((c) => (c.bands ?? []).length > 0);
  return criteria.map((rc, i) => {
    const given = input.find((c) => c.index === i || c.label?.trim().toLowerCase() === rc.label.trim().toLowerCase());
    if (given == null || typeof given.points !== "number") {
      throw new AppealError(422, "scores_incomplete", `Score manquant pour « ${rc.label} » : chaque critère doit être noté`);
    }
    if (banded && !given.evidence?.trim()) {
      throw new AppealError(422, "missing_evidence", `Preuve requise pour « ${rc.label} » (règle 3 du socle) — le second évaluateur reporte SES preuves`);
    }
    const points = Math.max(0, Math.min(rc.weightPoints, Math.round(given.points)));
    return { label: rc.label, points, evidence: given.evidence?.trim() ?? null };
  });
}

/** Le futur évaluateur de recours/QC : habilité, et étranger au dossier. */
async function assertBlindEvaluator(
  enrollmentId: string, courseId: string, evaluatorId: string, excluded: (string | null | undefined)[],
) {
  if (excluded.filter(Boolean).includes(evaluatorId)) {
    throw new AppealError(409, "appeal_conflict", "Cet évaluateur a participé à la notation de ce dossier : le recours exige une instance distincte (§10)");
  }
  const acc = await activeAccreditation(evaluatorId, courseId);
  if (!acc) throw new AppealError(409, "not_accredited", "Habilitation active requise sur ce parcours (§9.2)");
  const [evaluator, enrollment] = await Promise.all([
    prisma.user.findUnique({ where: { id: evaluatorId } }),
    prisma.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { user: true } }),
  ]);
  if (!evaluator) throw new AppealError(404, "evaluator_not_found", "Évaluateur introuvable");
  // Incompatibilités §5.1 toujours applicables : pair de progression, même
  // organisation. (FACE2FACE et relance sont contrôlés à l'assignation initiale.)
  if (enrollment.peerEmail && evaluator.email.toLowerCase() === enrollment.peerEmail.toLowerCase()) {
    throw new AppealError(409, "incompat_peer", "Cet évaluateur est le pair de progression du candidat (§5.1)");
  }
  const sharedOrg = await prisma.organizationMembership.findFirst({
    where: { userId: evaluatorId, organization: { memberships: { some: { userId: enrollment.userId } } } },
  });
  if (sharedOrg) throw new AppealError(409, "incompat_org", "Évaluateur et candidat appartiennent à la même organisation (§5.1)");
  return evaluator;
}

// ---------------------------------------------------------------------------
// Recours §10
// ---------------------------------------------------------------------------

/** Étape 1 — le candidat conteste par écrit (15 jours calendaires). */
export async function openAppeal(
  enrollmentId: string, userId: string,
  input: { contestedCriteria: string[]; statement: string },
) {
  const { enrollment, submission, criteria } = await loadCtx(enrollmentId);
  if (enrollment.userId !== userId) throw new AppealError(403, "not_owner", "Seul le candidat peut contester sa décision");
  if (!submission.decision || !submission.evaluatedAt) {
    throw new AppealError(409, "no_decision", "Aucune décision à contester : le dossier n'a pas encore été noté");
  }
  if (!appealWindowOpen(submission.evaluatedAt, new Date())) {
    throw new AppealError(422, "window_closed", "Le délai de contestation est dépassé (15 jours calendaires après la décision, §10 étape 1)");
  }
  const existing = await prisma.appeal.findUnique({ where: { enrollmentId } });
  if (existing) throw new AppealError(409, "appeal_exists", "Un recours a déjà été déposé : la décision issue du recours est finale (§10)");
  const labels = new Set(criteria.map((c) => c.label));
  for (const c of input.contestedCriteria) {
    if (!labels.has(c)) throw new AppealError(422, "unknown_criterion", `Critère contesté inconnu : « ${c} »`);
  }
  if (!input.contestedCriteria.length) throw new AppealError(422, "criteria_required", "Indiquer au moins un critère contesté (§10 étape 1)");
  if (!input.statement.trim()) throw new AppealError(422, "statement_required", "Indiquer les éléments du dossier estimés non pris en compte (§10 étape 1)");

  const firstScores = ((submission.criteria ?? []) as { label?: string; points: number }[])
    .map((c, i) => ({ label: c.label ?? criteria[i]?.label ?? `#${i}`, points: c.points }));
  const now = new Date();
  const appeal = await prisma.appeal.create({
    data: {
      enrollmentId,
      contestedCriteria: input.contestedCriteria as unknown as Prisma.InputJsonValue,
      statement: input.statement.trim(),
      firstEvaluatorId: submission.evaluatorId,
      firstScores: firstScores as unknown as Prisma.InputJsonValue,
      firstTotal: submission.scoreTotal ?? 0,
      step2DueAt: addBusinessDays(now, APPEAL_ASSIGN_BUSINESS_DAYS),
    },
  });
  // §8.7 : recours ouvert → suggestion automatisée indisponible sur ce dossier.
  await prisma.projectSubmission.update({ where: { enrollmentId }, data: { appealStage: 1 } });
  await audit({ actorId: userId, action: "appeal.open", targetType: "Enrollment", targetId: enrollmentId, meta: { contestedCriteria: input.contestedCriteria } });
  await enqueueNotification({
    enrollmentId, recipientKind: "ADMIN", recipient: ADMIN_EMAIL,
    subject: "Recours déposé (§10)",
    body: `${enrollment.user.name} conteste la décision « ${submission.decision} » (${submission.scoreTotal}/100).\nCritères contestés : ${input.contestedCriteria.join(" · ")}.\nÉtape 2 : désigner un second évaluateur sous ${APPEAL_ASSIGN_BUSINESS_DAYS} jours ouvrables.`,
    provider: "appeal",
  });
  return appeal;
}

/** Étapes 2 (second évaluateur) et 4→ (troisième évaluateur si écart ≥ 10). */
export async function assignAppealEvaluator(enrollmentId: string, evaluatorId: string, actorId: string) {
  const { enrollment } = await loadCtx(enrollmentId);
  const appeal = await prisma.appeal.findUnique({ where: { enrollmentId } });
  if (!appeal) throw new AppealError(404, "no_appeal", "Aucun recours ouvert sur ce dossier");

  if (appeal.status === "OPEN") {
    const evaluator = await assertBlindEvaluator(enrollmentId, enrollment.courseId, evaluatorId, [appeal.firstEvaluatorId]);
    const now = new Date();
    const updated = await prisma.appeal.update({
      where: { enrollmentId },
      data: {
        secondEvaluatorId: evaluatorId, secondAssignedAt: now, status: "SECOND_ASSIGNED",
        step3DueAt: addBusinessDays(now, APPEAL_GRADE_BUSINESS_DAYS),
      },
    });
    await prisma.projectSubmission.update({ where: { enrollmentId }, data: { appealStage: 2 } });
    await audit({ actorId, action: "appeal.assign_second", targetType: "Enrollment", targetId: enrollmentId, meta: { evaluatorId } });
    await enqueueNotification({
      enrollmentId, recipientKind: "ADMIN", recipient: evaluator.email,
      subject: "Recours — notation à l'aveugle demandée (§10 étape 3)",
      body: `Vous êtes désigné second évaluateur du dossier de ${enrollment.user.name}. Notez À L'AVEUGLE avec la grille du parcours et reportez vos preuves, sous ${APPEAL_GRADE_BUSINESS_DAYS} jours ouvrables. La suggestion automatisée est désactivée (§8.7). Les scores de la première notation ne vous seront pas communiqués.`,
      provider: "appeal",
    });
    return updated;
  }
  if (appeal.status === "THIRD_REQUIRED") {
    const evaluator = await assertBlindEvaluator(enrollmentId, enrollment.courseId, evaluatorId, [appeal.firstEvaluatorId, appeal.secondEvaluatorId]);
    const updated = await prisma.appeal.update({
      where: { enrollmentId },
      data: { thirdEvaluatorId: evaluatorId, thirdAssignedAt: new Date(), status: "THIRD_ASSIGNED" },
    });
    await prisma.projectSubmission.update({ where: { enrollmentId }, data: { appealStage: 3 } });
    await audit({ actorId, action: "appeal.assign_third", targetType: "Enrollment", targetId: enrollmentId, meta: { evaluatorId } });
    await enqueueNotification({
      enrollmentId, recipientKind: "ADMIN", recipient: evaluator.email,
      subject: "Recours — troisième évaluateur (§10 étape 4)",
      body: `L'écart entre les deux notations du dossier de ${enrollment.user.name} atteint ${appeal.gap} points : votre décision tranchera et sera définitive. Notation à l'aveugle, preuves reportées.`,
      provider: "appeal",
    });
    return updated;
  }
  throw new AppealError(409, "bad_status", `Aucune assignation possible au statut « ${appeal.status} »`);
}

/** Étapes 3 et 4 — notation à l'aveugle du second (puis du troisième), et
 *  résolution immédiate : moyenne (< 10) ou décision du troisième (≥ 10). */
export async function gradeAppeal(
  enrollmentId: string, gradedBy: string,
  input: { criteria: { index?: number; label?: string; points: number; evidence?: string }[] },
) {
  const { enrollment, criteria } = await loadCtx(enrollmentId);
  const appeal = await prisma.appeal.findUnique({ where: { enrollmentId } });
  if (!appeal) throw new AppealError(404, "no_appeal", "Aucun recours ouvert sur ce dossier");
  const acc = await activeAccreditation(gradedBy, enrollment.courseId);
  if (!acc) throw new AppealError(403, "not_accredited", "Habilitation active requise (§9.2)");

  const scored = validateBlindScores(criteria, input.criteria);
  const total = scored.reduce((a, x) => a + x.points, 0);
  const firstPts = ((appeal.firstScores ?? []) as { points: number }[]).map((s) => s.points);

  if (appeal.status === "SECOND_ASSIGNED") {
    if (appeal.secondEvaluatorId !== gradedBy) {
      throw new AppealError(403, "not_appeal_evaluator", "Seul le second évaluateur désigné peut noter ce recours");
    }
    const resolution = resolveAppeal(firstPts, scored.map((s) => s.points));
    if (resolution.needsThird) {
      const updated = await prisma.appeal.update({
        where: { enrollmentId },
        data: {
          secondScores: scored as unknown as Prisma.InputJsonValue, secondTotal: total,
          secondGradedAt: new Date(), gap: resolution.gap, status: "THIRD_REQUIRED",
        },
      });
      await audit({ actorId: gradedBy, action: "appeal.third_required", targetType: "Enrollment", targetId: enrollmentId, meta: { gap: resolution.gap } });
      await enqueueNotification({
        enrollmentId, recipientKind: "ADMIN", recipient: ADMIN_EMAIL,
        subject: "Recours — troisième évaluateur requis (§10 étape 4)",
        body: `Écart de ${resolution.gap} points (≥ 10) entre les deux notations du dossier de ${enrollment.user.name} : désigner un troisième évaluateur, dont la décision sera définitive.`,
        provider: "appeal",
      });
      return { appeal: updated, gap: resolution.gap, needsThird: true as const };
    }
    // Moyenne par critère : elle fait foi. Les preuves appliquées sont celles
    // reportées par le second évaluateur (les deux notations restent au registre).
    await prisma.appeal.update({
      where: { enrollmentId },
      data: {
        secondScores: scored as unknown as Prisma.InputJsonValue, secondTotal: total,
        secondGradedAt: new Date(), gap: resolution.gap,
      },
    });
    return finalizeAppeal(enrollmentId, resolution.averagedScores!, scored, gradedBy, resolution.gap, "moyenne des deux notations (écart < 10)");
  }

  if (appeal.status === "THIRD_ASSIGNED") {
    if (appeal.thirdEvaluatorId !== gradedBy) {
      throw new AppealError(403, "not_appeal_evaluator", "Seul le troisième évaluateur désigné peut trancher ce recours");
    }
    await prisma.appeal.update({
      where: { enrollmentId },
      data: { thirdScores: scored as unknown as Prisma.InputJsonValue, thirdTotal: total },
    });
    return finalizeAppeal(enrollmentId, scored.map((s) => s.points), scored, gradedBy, appeal.gap ?? 0, "décision du troisième évaluateur (définitive)");
  }

  throw new AppealError(409, "bad_status", `Aucune notation possible au statut « ${appeal.status} »`);
}

/** Étape 5 — applique la décision finale et notifie, motivé critère par critère. */
async function finalizeAppeal(
  enrollmentId: string,
  finalPoints: number[],
  evidenced: { label: string; points: number; evidence: string | null }[],
  gradedBy: string,
  gap: number,
  viaLabel: string,
) {
  const { enrollment, criteria } = await loadCtx(enrollmentId);
  // La décision issue du recours remplace la notation au dossier (décision,
  // score, statut, certificat le cas échéant) — via le service officiel.
  const result = await recordRubricEvaluation(enrollmentId, {
    criteria: finalPoints.map((points, index) => ({ index, points, evidence: evidenced[index]?.evidence ?? "Preuve reportée au registre du recours (§10)" })),
    notes: `Décision issue du recours : ${viaLabel}.`,
  }, gradedBy);
  const decision = (result as { evaluation?: { decision?: string } }).evaluation?.decision ?? "";
  const finalTotal = finalPoints.reduce((a, x) => a + x, 0);
  const now = new Date();
  const appeal = await prisma.appeal.update({
    where: { enrollmentId },
    data: {
      finalScores: finalPoints.map((points, i) => ({ label: criteria[i]!.label, points })) as unknown as Prisma.InputJsonValue,
      finalTotal, finalDecision: decision, decidedAt: now, status: "DECIDED", gap,
      step5DueAt: addBusinessDays(now, APPEAL_NOTIFY_BUSINESS_DAYS),
    },
  });
  const detail = criteria.map((c, i) => `- ${c.label} : ${finalPoints[i]}/${c.weightPoints}`).join("\n");
  const DECISION_FR: Record<string, string> = { CERTIFIED: "Certifié", RESUBMIT: "Remise demandée", NOT_CERTIFIED: "Non certifié" };
  await enqueueNotification({
    enrollmentId, recipientKind: "LEARNER", recipient: enrollment.user.email,
    subject: "Recours — décision finale (§10 étape 5)",
    body: `Votre recours a été instruit (${viaLabel} ; écart constaté : ${gap} points).\n\nNotation finale, critère par critère :\n${detail}\n\nTotal : ${finalTotal}/100 — décision : ${DECISION_FR[decision] ?? decision}.\n\nLa décision issue du recours est finale (§10).`,
    provider: "appeal",
  });
  await audit({ actorId: gradedBy, action: "appeal.decide", targetType: "Enrollment", targetId: enrollmentId, meta: { finalTotal, decision, gap, via: viaLabel } });
  return { appeal, decision, finalTotal, gap, needsThird: false as const };
}

/** Registre des recours (§10) + taux (> 5 % des dossiers = défaut de grille). */
export async function listAppeals() {
  const [appeals, gradedCount] = await Promise.all([
    prisma.appeal.findMany({ orderBy: { openedAt: "desc" }, include: { enrollment: { include: { user: { select: { name: true, email: true } } } } } }),
    prisma.projectSubmission.count({ where: { decision: { not: null } } }),
  ]);
  const ratePct = gradedCount === 0 ? null : Math.round((appeals.length / gradedCount) * 100);
  return {
    ratePct, rateAlert: ratePct !== null && ratePct > 5, graded: gradedCount,
    appeals: appeals.map((a) => ({
      id: a.id, enrollmentId: a.enrollmentId,
      candidate: { name: a.enrollment.user.name, email: a.enrollment.user.email },
      openedAt: a.openedAt, status: a.status,
      contestedCriteria: a.contestedCriteria, statement: a.statement,
      firstTotal: a.firstTotal, secondTotal: a.secondTotal, thirdTotal: a.thirdTotal,
      gap: a.gap, finalTotal: a.finalTotal, finalDecision: a.finalDecision, decidedAt: a.decidedAt,
      secondEvaluatorId: a.secondEvaluatorId, thirdEvaluatorId: a.thirdEvaluatorId,
      step2DueAt: a.step2DueAt, step3DueAt: a.step3DueAt, step5DueAt: a.step5DueAt,
    })),
  };
}

/** Suivi candidat : étapes et décision — jamais les scores intermédiaires
 *  avant la décision (notation à l'aveugle). */
export async function getAppeal(enrollmentId: string) {
  const appeal = await prisma.appeal.findUnique({ where: { enrollmentId } });
  if (!appeal) return null;
  return {
    status: appeal.status, openedAt: appeal.openedAt,
    contestedCriteria: appeal.contestedCriteria, statement: appeal.statement,
    decided: appeal.status === "DECIDED",
    finalTotal: appeal.status === "DECIDED" ? appeal.finalTotal : null,
    finalDecision: appeal.status === "DECIDED" ? appeal.finalDecision : null,
    decidedAt: appeal.decidedAt,
  };
}

// ---------------------------------------------------------------------------
// Surveillance continue §9.3 — double notation à l'aveugle
// ---------------------------------------------------------------------------

/** Assigne (ou crée puis assigne) une double notation : sur une ligne
 *  sélectionnée automatiquement (1 sur 10) ou en ajout manuel. */
export async function assignDoubleMarking(enrollmentId: string, evaluatorId: string, actorId: string) {
  const { enrollment, submission } = await loadCtx(enrollmentId);
  if (!submission.decision || submission.scoreTotal == null) {
    throw new AppealError(409, "not_graded", "La double notation porte sur un dossier réel déjà noté (§9.3)");
  }
  await assertBlindEvaluator(enrollmentId, enrollment.courseId, evaluatorId, [submission.evaluatorId]);
  const pending = await prisma.doubleMarking.findFirst({ where: { enrollmentId, status: "REQUIRED" } });
  const row = pending
    ? await prisma.doubleMarking.update({ where: { id: pending.id }, data: { secondEvaluatorId: evaluatorId, assignedAt: new Date(), status: "ASSIGNED" } })
    : await prisma.doubleMarking.create({
        data: {
          enrollmentId, sequence: 0,
          firstEvaluatorId: submission.evaluatorId,
          firstScores: (submission.criteria ?? []) as Prisma.InputJsonValue,
          firstTotal: submission.scoreTotal,
          secondEvaluatorId: evaluatorId, assignedAt: new Date(), status: "ASSIGNED",
        },
      });
  await audit({ actorId, action: "qc.assign", targetType: "Enrollment", targetId: enrollmentId, meta: { evaluatorId, manual: !pending } });
  return row;
}

/** Notation aveugle du second évaluateur : n'altère JAMAIS la note officielle.
 *  Écart > 15 → incident (un troisième évaluateur tranche, consigné). */
export async function gradeDoubleMarking(
  id: string, gradedBy: string,
  input: { criteria: { index?: number; label?: string; points: number; evidence?: string }[] },
) {
  const row = await prisma.doubleMarking.findUnique({ where: { id } });
  if (!row) throw new AppealError(404, "not_found", "Double notation introuvable");
  if (row.status !== "ASSIGNED") throw new AppealError(409, "bad_status", `Statut « ${row.status} » : notation impossible`);
  if (row.secondEvaluatorId !== gradedBy) throw new AppealError(403, "not_qc_evaluator", "Seul l'évaluateur désigné note cette double notation");
  const { enrollment, criteria } = await loadCtx(row.enrollmentId);
  const acc = await activeAccreditation(gradedBy, enrollment.courseId);
  if (!acc) throw new AppealError(403, "not_accredited", "Habilitation active requise (§9.2)");
  const scored = validateBlindScores(criteria, input.criteria);
  const total = scored.reduce((a, x) => a + x.points, 0);
  const gap = Math.abs(total - row.firstTotal);
  const incident = gap > 15;
  const updated = await prisma.doubleMarking.update({
    where: { id },
    data: {
      secondScores: scored as unknown as Prisma.InputJsonValue, secondTotal: total,
      gradedAt: new Date(), gap, status: incident ? "INCIDENT" : "GRADED",
    },
  });
  await audit({ actorId: gradedBy, action: incident ? "qc.incident" : "qc.graded", targetType: "Enrollment", targetId: row.enrollmentId, meta: { gap, firstTotal: row.firstTotal, secondTotal: total } });
  if (incident) {
    await enqueueNotification({
      enrollmentId: row.enrollmentId, recipientKind: "ADMIN", recipient: ADMIN_EMAIL,
      subject: "Contrôle qualité — incident de double notation (§9.3)",
      body: `Écart de ${gap} points (> 15) sur le dossier de ${enrollment.user.name} (${row.firstTotal} vs ${total}). Un troisième évaluateur doit trancher ; l'incident est consigné au journal de calibration.`,
      provider: "qc",
    });
  }
  return updated;
}

/** Résolution d'un incident : le troisième évaluateur tranche, tout est consigné. */
export async function resolveDoubleMarking(
  id: string, actorId: string,
  input: { thirdEvaluatorId: string; thirdTotal: number; notes: string },
) {
  const row = await prisma.doubleMarking.findUnique({ where: { id } });
  if (!row) throw new AppealError(404, "not_found", "Double notation introuvable");
  if (row.status !== "INCIDENT") throw new AppealError(409, "bad_status", "Seul un incident (> 15 pts) se résout par un troisième évaluateur");
  const { enrollment } = await loadCtx(row.enrollmentId);
  await assertBlindEvaluator(row.enrollmentId, enrollment.courseId, input.thirdEvaluatorId, [row.firstEvaluatorId, row.secondEvaluatorId]);
  const updated = await prisma.doubleMarking.update({
    where: { id },
    data: {
      thirdEvaluatorId: input.thirdEvaluatorId, thirdTotal: Math.max(0, Math.min(100, Math.round(input.thirdTotal))),
      resolutionNotes: input.notes.trim(), resolvedAt: new Date(), status: "RESOLVED",
    },
  });
  await audit({ actorId, action: "qc.resolve", targetType: "Enrollment", targetId: row.enrollmentId, meta: { thirdEvaluatorId: input.thirdEvaluatorId, thirdTotal: input.thirdTotal } });
  return updated;
}

/** Registre + synthèse trimestrielle (médiane > 8 → réviser/recalibrer). */
export async function listDoubleMarkings() {
  const rows = await prisma.doubleMarking.findMany({
    orderBy: { createdAt: "desc" },
    include: { enrollment: { include: { user: { select: { name: true, email: true } } } } },
  });
  const now = new Date();
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  const quarterGaps = rows.filter((r) => r.gap != null && r.gradedAt && r.gradedAt >= quarterStart).map((r) => r.gap!);
  return {
    summary: qcSummary(quarterGaps),
    rows: rows.map((r) => ({
      id: r.id, enrollmentId: r.enrollmentId, sequence: r.sequence, status: r.status,
      candidate: { name: r.enrollment.user.name, email: r.enrollment.user.email },
      firstTotal: r.firstTotal, secondTotal: r.secondTotal, gap: r.gap,
      secondEvaluatorId: r.secondEvaluatorId, thirdEvaluatorId: r.thirdEvaluatorId,
      thirdTotal: r.thirdTotal, resolutionNotes: r.resolutionNotes,
      createdAt: r.createdAt, gradedAt: r.gradedAt, resolvedAt: r.resolvedAt,
    })),
  };
}
