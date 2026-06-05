/**
 * enrollments.service.ts — the learner-side runtime engine.
 *
 * Orchestrates: enrolment in a published version → Moment d'Ancrage capture →
 * progress recording (with quiz scoring) → block gating recomputation → badge
 * issuance (PAM-anchored, peer-notified) → PAM-injected block rendering.
 */
import { Prisma, type ItemType } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { CourseContent, type CourseContent as CourseContentT } from "../../domain/content-model.js";
import { computeProgress, scoreQuiz, diagnosticProfile, type CompletionRecord } from "../../domain/engine/progress.js";
import { injectMomentAncrage } from "../../domain/engine/injection.js";
import { badgeMessage, badgeTypeForBlock, peerNotificationText } from "../../domain/engine/badges.js";
import { computeResume } from "../../domain/engine/resume.js";
import { SLA_TURNAROUND_BUSINESS_DAYS } from "../../domain/engine/sla.js";
import { hasPermission } from "../../domain/auth/permissions.js";
import { activityId, buildStatement, quizResult, secondsToIsoDuration, XAPI_EXT, type VerbKey } from "../../domain/engine/xapi.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import { issueCredential } from "../credentials/credentials.service.js";
import { dispatchEvent } from "../../lib/webhooks/webhooks.js";
import { env } from "../../config/env.js";

export class EngineError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}

type Context = {
  enrollment: Awaited<ReturnType<typeof prisma.enrollment.findUnique>> & {};
  content: CourseContentT;
};

async function loadContext(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { courseVersion: true, course: true, user: true, completions: true, badges: true },
  });
  if (!enrollment) throw new EngineError(404, "not_found", "Inscription introuvable");
  const content = CourseContent.parse(enrollment.courseVersion.content);
  return { enrollment, content };
}

/** Record an xAPI statement for this enrolment (stored locally; forwardable). */
async function emitXapi(
  ctx: Awaited<ReturnType<typeof loadContext>>,
  verb: VerbKey,
  objectParts: string[],
  objectName: string,
  result?: Parameters<typeof buildStatement>[0]["result"],
  contextExtensions?: Record<string, unknown>,
) {
  const { enrollment } = ctx;
  const objectId = activityId(enrollment.course.slug, objectParts);
  const statement = buildStatement({
    actor: { name: enrollment.user.name, userId: enrollment.userId },
    verb, objectId, objectName, result, enrollmentId: enrollment.id, contextExtensions,
  });
  await prisma.xapiStatement.create({
    data: { enrollmentId: enrollment.id, verb, objectId, statement: statement as unknown as Prisma.InputJsonValue },
  });
}

/** Per-question response metadata the client may attach for granular xAPI. */
type QuestionMeta = Record<string, { timeMs?: number; feedbackViewed?: boolean }>;

/**
 * Emit one `answered` statement per question (§5.2 / AC#11): records question
 * ID, selected option, correct option, time-on-question (s), and feedback-viewed.
 */
async function emitQuestionStatements(
  ctx: Awaited<ReturnType<typeof loadContext>>,
  blockIndex: number,
  itemKey: string,
  questions: { id: string; correctKey?: string }[],
  answers: Record<string, string>,
  meta: QuestionMeta = {},
) {
  for (const q of questions) {
    const selected = answers[q.id];
    if (selected == null) continue;
    const m = meta[q.id] ?? {};
    const correct = q.correctKey != null ? selected === q.correctKey : undefined;
    const result: Parameters<typeof buildStatement>[0]["result"] = {
      response: selected,
      ...(correct != null ? { success: correct } : {}),
      ...(m.timeMs != null ? { duration: secondsToIsoDuration(m.timeMs / 1000) } : {}),
      extensions: {
        ...(q.correctKey != null ? { [XAPI_EXT.correctResponse]: q.correctKey } : {}),
        [XAPI_EXT.feedbackViewed]: Boolean(m.feedbackViewed),
        ...(m.timeMs != null ? { [XAPI_EXT.timeOnTaskSeconds]: Math.round(m.timeMs / 1000) } : {}),
      },
    };
    await emitXapi(
      ctx, "answered", [`blocks/${blockIndex}`, `items/${itemKey}`, `questions/${q.id}`],
      `Question ${q.id}`, result,
      { [XAPI_EXT.block]: blockIndex, [XAPI_EXT.session]: itemKey },
    );
  }
}

/**
 * Reject writes to a block that is currently LOCKED (sequential-gating defence).
 * A completion/submission is only accepted when its block is `available` or
 * already `completed` (re-takes allowed). Bloc 0 is always reachable.
 */
function assertUnlocked(ctx: Awaited<ReturnType<typeof loadContext>>, blockIndex: number) {
  const progress = computeProgress(
    ctx.content, toRecords(ctx.enrollment.completions), Boolean(ctx.enrollment.momentAncrage),
  );
  const bp = progress.blocks[blockIndex];
  if (!bp) throw new EngineError(404, "no_block", "Bloc introuvable");
  if (bp.state === "locked") {
    throw new EngineError(403, "block_locked", `Le bloc ${blockIndex} est verrouillé — terminez d'abord le bloc précédent`);
  }
}

/** Bump activity timestamp (auto-resume + inactivity) and optionally the position. */
async function touch(enrollmentId: string, blockIndex?: number, itemKey?: string) {
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      lastSeenAt: new Date(),
      ...(blockIndex != null ? { lastBlockIndex: blockIndex } : {}),
      ...(itemKey != null ? { lastItemKey: itemKey } : {}),
    },
  });
}

function toRecords(completions: { blockIndex: number; itemKey: string; scorePct: number | null }[]): CompletionRecord[] {
  return completions.map((c) => ({ blockIndex: c.blockIndex, itemKey: c.itemKey, scorePct: c.scorePct }));
}

// --- enrolment --------------------------------------------------------------

export async function enroll(userId: string, courseId: string, isEnterprise = false) {
  const version = await prisma.courseVersion.findFirst({
    where: { courseId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
  if (!version) throw new EngineError(409, "no_published_version", "Aucune version publiée pour ce parcours");

  try {
    const enrollment = await prisma.enrollment.create({
      data: { userId, courseId, courseVersionId: version.id, isEnterprise, lastSeenAt: new Date() },
    });
    const ctx = await loadContext(enrollment.id);
    await emitXapi(ctx, "initialized", [], ctx.content.title);
    return enrollment;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new EngineError(409, "already_enrolled", "Cet apprenant est déjà inscrit à ce parcours");
    }
    throw e;
  }
}

/** B2C self-enrolment: a learner enrols THEMSELVES, restricted to platform
 *  courses or courses of an org they belong to (tenant isolation). */
export async function selfEnroll(userId: string, courseId: string, memberOrgIds: string[]) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  if (!course) throw new EngineError(404, "no_course", "Parcours introuvable");
  if (course.organizationId && !memberOrgIds.includes(course.organizationId)) {
    throw new EngineError(403, "course_forbidden", "Parcours non disponible");
  }
  return enroll(userId, courseId, false);
}

// --- Moment d'Ancrage -------------------------------------------------------

export async function captureMomentAncrage(enrollmentId: string, text: string) {
  const { content } = await loadContext(enrollmentId);
  const onboarding = content.blocks.find((b) => b.type === "ONBOARDING");
  const courseMin = onboarding?.type === "ONBOARDING" ? onboarding.payload.momentAncrage.minChars : 50;
  // Per-course minimum, with a configurable platform-wide floor (§6.1).
  const minChars = Math.max(courseMin, env.PAM_MIN_CHARS);
  const trimmed = text.trim();
  if (trimmed.length < minChars) {
    throw new EngineError(422, "too_short", `Le Moment d'Ancrage doit faire au moins ${minChars} caractères`);
  }
  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { momentAncrage: trimmed } });
  await touch(enrollmentId, 0, "moment-ancrage");
  await emitXapi(await loadContext(enrollmentId), "completed", ["moment-ancrage"], "Moment d'Ancrage");
  return reconcile(enrollmentId);
}

// --- peer -------------------------------------------------------------------

export async function designatePeer(enrollmentId: string, name: string, email: string, phone?: string) {
  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { peerName: name, peerEmail: email, peerPhone: phone ?? null } });
  await upsertCompletion(enrollmentId, 0, "PEER", "peer", null, { name, email, phone: phone ?? null });
  await touch(enrollmentId, 0, "peer");
  return reconcile(enrollmentId);
}

// --- generic item completion ------------------------------------------------

async function upsertCompletion(
  enrollmentId: string, blockIndex: number, itemType: ItemType, itemKey: string,
  scorePct: number | null, data: unknown,
) {
  return prisma.itemCompletion.upsert({
    where: { enrollmentId_blockIndex_itemKey: { enrollmentId, blockIndex, itemKey } },
    update: { scorePct, data: data as Prisma.InputJsonValue },
    create: { enrollmentId, blockIndex, itemType, itemKey, scorePct, data: data as Prisma.InputJsonValue },
  });
}

/** Exercise interaction metadata for granular xAPI (§5.3 / §5.4). */
export type ExerciseMeta = { timeMs?: number; feedbackViewed?: boolean; response?: string; correct?: boolean };

export async function completeItem(
  enrollmentId: string, blockIndex: number, itemType: ItemType, itemKey: string, data?: unknown, meta: ExerciseMeta = {},
) {
  const ctx = await loadContext(enrollmentId); // validates existence
  assertUnlocked(ctx, blockIndex);
  const hasMeta = meta.timeMs != null || meta.feedbackViewed != null || meta.response != null || meta.correct != null;
  await upsertCompletion(enrollmentId, blockIndex, itemType, itemKey, null, data ?? null);
  // Bloc 4 project: open/refresh the certification-project record (starts the
  // 5-business-day SLA clock). The full lifecycle is kept in-platform (§6.3).
  if (itemType === "PROJECT") {
    await prisma.projectSubmission.upsert({
      where: { enrollmentId },
      update: { submittedAt: new Date(), content: (data ?? null) as Prisma.InputJsonValue, revisionStatus: "SUBMITTED", slaAlertedAt: null },
      create: { enrollmentId, blockIndex, content: (data ?? null) as Prisma.InputJsonValue },
    });
    await dispatchEvent("PROJECT_SUBMITTED", {
      enrollmentId, learnerId: ctx.enrollment.userId, courseId: ctx.enrollment.courseId, blockIndex,
    }, ctx.enrollment.course.organizationId);
  }
  // Exercise-submission webhook (§5.4): pass learner response + PAM + context so
  // an external service can generate contextualised feedback.
  if (hasMeta && meta.response != null) {
    await dispatchEvent("EXERCISE_SUBMITTED", {
      enrollmentId, learnerId: ctx.enrollment.userId, courseId: ctx.enrollment.courseId,
      blockIndex, exerciseId: itemKey, response: meta.response, correct: meta.correct ?? null,
      momentAncrage: ctx.enrollment.momentAncrage ?? null,
    }, ctx.enrollment.course.organizationId);
  }
  await touch(enrollmentId, blockIndex, itemKey);
  // Exercise-completion statement with time-on-exercise + feedback-viewed (§5.4).
  const result = hasMeta ? {
    completion: true,
    ...(meta.response != null ? { response: meta.response } : {}),
    ...(meta.correct != null ? { success: meta.correct } : {}),
    ...(meta.timeMs != null ? { duration: secondsToIsoDuration(meta.timeMs / 1000) } : {}),
    extensions: {
      [XAPI_EXT.feedbackViewed]: Boolean(meta.feedbackViewed),
      ...(meta.timeMs != null ? { [XAPI_EXT.timeOnTaskSeconds]: Math.round(meta.timeMs / 1000) } : {}),
    },
  } : undefined;
  await emitXapi(
    ctx, "completed", [`blocks/${blockIndex}`, `items/${itemKey}`], `${itemType} ${itemKey}`, result,
    { [XAPI_EXT.block]: blockIndex, [XAPI_EXT.session]: itemKey, [XAPI_EXT.exercise]: itemKey },
  );
  return reconcile(enrollmentId);
}

/**
 * Assign an evaluator (an EVALUATOR / staff user) to a Bloc 4 project (§6.3).
 * The learner must have submitted the project first.
 */
export async function assignEvaluator(enrollmentId: string, evaluatorId: string) {
  const submission = await prisma.projectSubmission.findUnique({ where: { enrollmentId } });
  if (!submission) throw new EngineError(409, "no_submission", "Aucun projet soumis pour cette inscription");
  const evaluator = await prisma.user.findUnique({ where: { id: evaluatorId } });
  if (!evaluator) throw new EngineError(404, "no_evaluator", "Évaluateur introuvable");
  if (!hasPermission(evaluator.role, "evaluation:grade")) {
    throw new EngineError(422, "not_evaluator", `${evaluator.name} ne peut pas évaluer (rôle ${evaluator.role})`);
  }
  const updated = await prisma.projectSubmission.update({
    where: { enrollmentId },
    data: {
      evaluatorId, assignedAt: new Date(),
      revisionStatus: submission.evaluatedAt ? submission.revisionStatus : "ASSIGNED",
    },
  });
  // Notify the evaluator that work is waiting (in-platform, not e-mail-only).
  await enqueueNotification({
    enrollmentId, recipientKind: "ADMIN", recipient: evaluator.email,
    subject: "Projet de certification à évaluer",
    body: `Un projet de certification (Bloc 4) vous a été assigné. Engagement de retour : ${SLA_TURNAROUND_BUSINESS_DAYS} jours ouvrés.`,
    provider: "project",
  });
  return updated;
}

/** Full project record for verification / reporting (§6.3 metadata). */
export async function getProjectSubmission(enrollmentId: string) {
  const submission = await prisma.projectSubmission.findUnique({
    where: { enrollmentId },
    include: { evaluator: { select: { id: true, name: true, email: true } } },
  });
  if (!submission) throw new EngineError(404, "no_submission", "Aucun projet soumis pour cette inscription");
  return submission;
}

/**
 * Evaluation queue (Bloc 4) — every submitted project with learner, course,
 * status, assigned evaluator and the course rubric (so the admin console can
 * render the grading form). Oldest-submitted first (SLA priority).
 */
export async function listEvaluationQueue() {
  const subs = await prisma.projectSubmission.findMany({
    orderBy: { submittedAt: "asc" },
    include: {
      evaluator: { select: { id: true, name: true } },
      enrollment: { include: { user: { select: { name: true, email: true } }, courseVersion: { select: { title: true, content: true } } } },
    },
  });
  return subs.map((s) => {
    const content = s.enrollment.courseVersion.content as { blocks?: { type: string; payload?: { rubric?: unknown } }[] } | null;
    const b4 = content?.blocks?.find((b) => b.type === "CERTIFICATION");
    return {
      enrollmentId: s.enrollmentId,
      learner: { name: s.enrollment.user.name, email: s.enrollment.user.email },
      courseTitle: s.enrollment.courseVersion.title,
      submittedAt: s.submittedAt,
      revisionStatus: s.revisionStatus,
      scoreTotal: s.scoreTotal,
      evaluator: s.evaluator ? { id: s.evaluator.id, name: s.evaluator.name } : null,
      rubric: (b4?.payload?.rubric as { criteria: { label: string; weightPoints: number }[]; threshold: number } | undefined) ?? null,
    };
  });
}

// --- quizzes ----------------------------------------------------------------

/** Trigger quiz (Bloc 0) — non-scored; also records the chosen profile. */
export async function submitTriggerQuiz(enrollmentId: string, answers: Record<string, string>, profileKey?: string) {
  const ctx = await loadContext(enrollmentId);
  if (profileKey) {
    const onboarding = ctx.content.blocks.find((b) => b.type === "ONBOARDING");
    const choices = onboarding?.type === "ONBOARDING" ? onboarding.payload.profileChoices : [];
    if (!choices.some((c) => c.key === profileKey)) {
      throw new EngineError(422, "invalid_profile", `Profil « ${profileKey} » inconnu pour ce parcours`);
    }
  }
  await upsertCompletion(enrollmentId, 0, "TRIGGER_QUIZ", "trigger", null, { answers, profileKey: profileKey ?? null });
  if (profileKey) await upsertCompletion(enrollmentId, 0, "PROFILE", "profile", null, { profileKey });
  await touch(enrollmentId, 0, "trigger");
  await emitXapi(ctx, "completed", ["blocks/0", "items/trigger"], "Quiz déclencheur");
  return reconcile(enrollmentId);
}

/** Inter-block quiz (Bloc 2) — non-scored consolidation; records answers + correct count. */
export async function submitInterBlockQuiz(enrollmentId: string, answers: Record<string, string>, meta: QuestionMeta = {}) {
  const ctx = await loadContext(enrollmentId);
  const block = ctx.content.blocks.find((b) => b.type === "PRACTICE");
  if (block?.type !== "PRACTICE" || !block.payload.interBlockQuiz) {
    throw new EngineError(409, "no_quiz", "Ce parcours n'a pas de quiz interbloc");
  }
  assertUnlocked(ctx, block.index);
  const qs = block.payload.interBlockQuiz.questions;
  const { correct, total } = scoreQuiz(qs, answers); // for feedback only — not gated
  await upsertCompletion(enrollmentId, block.index, "INTER_BLOCK_QUIZ", "interblock", null, { answers, correct, total });
  await touch(enrollmentId, block.index, "interblock");
  await emitQuestionStatements(ctx, block.index, "interblock", qs, answers, meta);
  await emitXapi(ctx, "completed", [`blocks/${block.index}`, "items/interblock"], "Quiz interbloc");
  return { ...(await reconcile(enrollmentId)), quiz: { correct, total, scored: false } };
}

/** Diagnostic quiz (Bloc 1) — scored on /N, mapped to a profile band. */
export async function submitDiagnosticQuiz(enrollmentId: string, answers: Record<string, string>, meta: QuestionMeta = {}) {
  const ctx = await loadContext(enrollmentId);
  const block = ctx.content.blocks.find((b) => b.type === "COMPREHENSION");
  if (block?.type !== "COMPREHENSION") throw new EngineError(409, "no_block", "Bloc 1 absent");
  assertUnlocked(ctx, block.index);
  const qs = block.payload.diagnosticQuiz.questions;
  const { scorePct, correct, total, subAreaScores, priorities } = diagnosticProfile(qs, answers);
  const band = block.payload.diagnosticQuiz.profiles.find(
    (p) => correct >= p.scoreRange[0] && correct <= p.scoreRange[1],
  );
  // Competency entry profile: 2 weakest sub-areas framed as priorities (Pilier 2).
  await upsertCompletion(enrollmentId, block.index, "DIAGNOSTIC_QUIZ", "diagnostic", scorePct, {
    answers, correct, total, profile: band?.name ?? null, subAreaScores, priorities,
  });
  await touch(enrollmentId, block.index, "diagnostic");
  await emitQuestionStatements(ctx, block.index, "diagnostic", qs, answers, meta);
  await emitXapi(ctx, "completed", [`blocks/${block.index}`, "items/diagnostic"], "Quiz diagnostique", quizResult(scorePct, correct, total));
  return {
    ...(await reconcile(enrollmentId)),
    quiz: { scorePct, correct, total, profile: band?.name ?? null, subAreaScores, priorities },
  };
}

/** Final quiz (Bloc 3) — scored; gates Bloc 4 via the pass threshold. */
export async function submitFinalQuiz(enrollmentId: string, answers: Record<string, string>, meta: QuestionMeta = {}) {
  const ctx = await loadContext(enrollmentId);
  const block = ctx.content.blocks.find((b) => b.type === "ANCHORING");
  if (block?.type !== "ANCHORING") throw new EngineError(409, "no_block", "Bloc 3 absent");
  assertUnlocked(ctx, block.index);
  const qs = block.payload.finalQuiz.questions;
  const { scorePct, correct, total } = scoreQuiz(qs, answers);
  const threshold = block.payload.finalQuiz.passThreshold;
  await upsertCompletion(enrollmentId, block.index, "FINAL_QUIZ", "final", scorePct, { answers, correct, total });
  await touch(enrollmentId, block.index, "final");
  await emitQuestionStatements(ctx, block.index, "final", qs, answers, meta);
  const passed = scorePct >= threshold;
  await emitXapi(ctx, passed ? "passed" : "failed", [`blocks/${block.index}`, "items/final"], "Quiz final", quizResult(scorePct, correct, total, threshold));
  return { ...(await reconcile(enrollmentId)), quiz: { scorePct, correct, total, passed, threshold } };
}

export type RubricEvaluationInput = {
  /** Per-criterion points (preferred): the platform computes the weighted total. */
  criteria?: { label?: string; index?: number; points: number }[];
  /** Legacy single total (still accepted). */
  scorePct?: number;
  notes?: string;
};

/**
 * Human evaluator records the Bloc 4 rubric score (gates the certificate).
 * The evaluator scores EACH criterion (Pilier 6.3): each is clamped to its
 * weight and the weighted total (= sum, rubric totals 100) is computed by the
 * platform. A single `scorePct` is still accepted for compatibility.
 */
export async function recordRubricEvaluation(enrollmentId: string, input: RubricEvaluationInput, gradedBy?: string) {
  const ctx = await loadContext(enrollmentId);
  const block = ctx.content.blocks.find((b) => b.type === "CERTIFICATION");
  if (block?.type !== "CERTIFICATION") throw new EngineError(409, "no_block", "Bloc 4 absent");
  assertUnlocked(ctx, block.index);
  const rubric = block.payload.rubric;
  const threshold = rubric.threshold;

  let scorePct: number;
  let breakdown: { label: string; weightPoints: number; points: number }[] | null = null;
  if (input.criteria?.length) {
    breakdown = rubric.criteria.map((rc, i) => {
      const given = input.criteria!.find((c) => c.index === i || c.label?.trim().toLowerCase() === rc.label.trim().toLowerCase());
      const points = Math.max(0, Math.min(rc.weightPoints, Math.round(given?.points ?? 0)));
      return { label: rc.label, weightPoints: rc.weightPoints, points };
    });
    scorePct = breakdown.reduce((a, b) => a + b.points, 0); // weighted total (rubric = 100)
  } else if (input.scorePct != null) {
    scorePct = Math.max(0, Math.min(100, Math.round(input.scorePct)));
  } else {
    throw new EngineError(422, "missing_score", "Fournir criteria[] (par critère) ou scorePct");
  }

  const passed = scorePct >= threshold;
  await upsertCompletion(enrollmentId, block.index, "RUBRIC_EVALUATION", "rubric", scorePct, { notes: input.notes ?? null, criteria: breakdown });

  // Close the project lifecycle on the submission record (stops the SLA clock,
  // freezes the verification metadata) and notify the learner of the result.
  const submission = await prisma.projectSubmission.findUnique({ where: { enrollmentId } });
  if (submission) {
    await prisma.projectSubmission.update({
      where: { enrollmentId },
      data: {
        evaluatorId: submission.evaluatorId ?? gradedBy ?? null,
        scoreTotal: scorePct,
        criteria: (breakdown ?? null) as Prisma.InputJsonValue,
        feedback: input.notes ?? null,
        result: passed ? "PASS" : "FAIL",
        evaluatedAt: new Date(),
        revisionStatus: passed ? "PASSED" : "REVISION_REQUESTED",
      },
    });
    await enqueueNotification({
      enrollmentId, recipientKind: "LEARNER", recipient: ctx.enrollment.user.email,
      subject: passed ? "Projet de certification validé 🎉" : "Projet de certification — révision demandée",
      body: passed
        ? `Félicitations ! Votre projet a obtenu ${scorePct}/100 (seuil ${threshold}).${input.notes ? `\n\nRetour de l'évaluateur :\n${input.notes}` : ""}`
        : `Votre projet a obtenu ${scorePct}/100 (seuil ${threshold}). Une révision est demandée.${input.notes ? `\n\nRetour de l'évaluateur :\n${input.notes}` : ""}`,
      provider: "project",
    });
  }

  await emitXapi(ctx, passed ? "passed" : "failed", [`blocks/${block.index}`, "items/rubric"], "Évaluation grille", quizResult(scorePct, scorePct, 100, threshold));
  return { ...(await reconcile(enrollmentId)), evaluation: { scorePct, threshold, passed, breakdown } };
}

// --- reconciliation: recompute progress + issue badges ----------------------

export async function reconcile(enrollmentId: string) {
  const ctx = await loadContext(enrollmentId);
  const { enrollment, content } = ctx;
  const progress = computeProgress(content, toRecords(enrollment.completions), Boolean(enrollment.momentAncrage));

  const existingBadgeTypes = new Set(enrollment.badges.map((b) => b.type));
  const newlyIssued: { type: string; message: string }[] = [];

  for (const idx of progress.completedBlockIndexes) {
    const block = content.blocks[idx]!;
    const type = badgeTypeForBlock(block.type);
    if (existingBadgeTypes.has(type)) continue;
    const message = badgeMessage(type, block.badge.label, enrollment.momentAncrage);
    const badge = await prisma.badge.create({
      data: { enrollmentId, type, message, peerNotified: Boolean(enrollment.peerEmail) },
    });
    // Mint a verifiable credential (OB 2.0 + signed OB 3.0). Non-fatal.
    try {
      await issueCredential({
        badgeId: badge.id, enrollmentId, recipientEmail: enrollment.user.email, recipientName: enrollment.user.name,
        courseSlug: enrollment.course.slug, badgeType: type, content, block,
      });
    } catch (e) {
      console.error(`[credential] issuance failed for badge ${badge.id}:`, e instanceof Error ? e.message : e);
    }
    // Peer notification (Pilier 6.3) — by e-mail and, when a number is on file,
    // by mobile messaging (§7.1: e-mail alone underreaches African peers).
    if (enrollment.peerEmail || enrollment.peerPhone) {
      const peerBody = peerNotificationText(enrollment.peerName, enrollment.user.name, block.badge.label);
      if (enrollment.peerEmail) {
        await enqueueNotification({
          enrollmentId, recipientKind: "PEER", recipient: enrollment.peerEmail, channel: "EMAIL",
          subject: `${enrollment.user.name} a obtenu un badge 🏅`, body: peerBody, provider: "engine",
        });
      }
      if (enrollment.peerPhone) {
        await enqueueNotification({
          enrollmentId, recipientKind: "PEER", recipient: enrollment.peerPhone, channel: "WHATSAPP",
          body: peerBody, provider: "engine",
        });
      }
    }
    await emitXapi(ctx, "earned", [`blocks/${idx}`, `badges/${type}`], block.badge.label);
    // Outbound webhooks (§8.2): a newly completed block always means a new badge.
    await dispatchEvent("BLOCK_COMPLETED", {
      enrollmentId, learnerId: enrollment.userId, courseId: enrollment.courseId, blockIndex: idx, blockType: block.type,
    }, enrollment.course.organizationId);
    await dispatchEvent("BADGE_ISSUED", {
      enrollmentId, learnerId: enrollment.userId, courseId: enrollment.courseId, badgeType: type, badgeId: badge.id, label: block.badge.label,
    }, enrollment.course.organizationId);
    newlyIssued.push({ type, message });
  }

  // Anchor the journal trigger schedule when the certification block first
  // unlocks ("block start" — Pilier 5.1).
  const cert = content.blocks.find((b) => b.type === "CERTIFICATION");
  if (cert && !enrollment.journalStartedAt && progress.blocks[cert.index]?.state !== "locked") {
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { journalStartedAt: new Date() } });
  }

  // Course completion → CERTIFIED.
  if (progress.courseCompleted && enrollment.status !== "CERTIFIED") {
    await prisma.enrollment.update({
      where: { id: enrollmentId }, data: { status: "CERTIFIED", completedAt: new Date() },
    });
    await emitXapi(ctx, "passed", [], content.certificate.title, { completion: true, success: true });
    await dispatchEvent("CERTIFICATE_ISSUED", {
      enrollmentId, learnerId: enrollment.userId, courseId: enrollment.courseId, certificate: content.certificate.title,
    }, enrollment.course.organizationId);
  }

  const badges = await prisma.badge.findMany({ where: { enrollmentId }, orderBy: { issuedAt: "asc" } });
  return {
    progress, badges, newlyIssued,
    momentAncrageCaptured: Boolean(enrollment.momentAncrage),
    learnerName: enrollment.user.name,
    peer: enrollment.peerName ? { name: enrollment.peerName, notified: badges.length > 0 } : null,
  };
}

// --- auto-resume + position (Pilier 6.2) ------------------------------------

/**
 * Save the learner's position. `positionSec` is the in-video offset, rounded to
 * the nearest 5s and persisted per (block, item) so auto-resume restores the
 * exact spot across devices (server-side state — Pilier 4.2).
 */
export async function savePosition(enrollmentId: string, blockIndex: number, itemKey: string, positionSec?: number, durationSec?: number) {
  const ctx = await loadContext(enrollmentId);
  await touch(enrollmentId, blockIndex, itemKey);
  if (positionSec != null) {
    const rounded = Math.max(0, Math.round(positionSec / 5) * 5);
    await prisma.mediaPosition.upsert({
      where: { enrollmentId_blockIndex_itemKey: { enrollmentId, blockIndex, itemKey } },
      update: { positionSec: rounded, durationSec: durationSec ?? undefined },
      create: { enrollmentId, blockIndex, itemKey, positionSec: rounded, durationSec: durationSec ?? null },
    });
    // Video-progress statement (ADL Video Profile §8.1): position in seconds and,
    // when the length is known, fraction viewed.
    await emitXapi(
      ctx, "progressed", [`blocks/${blockIndex}`, `items/${itemKey}`, "video"], `Vidéo ${itemKey}`,
      {
        extensions: {
          [XAPI_EXT.videoTime]: rounded,
          ...(durationSec ? { [XAPI_EXT.videoLength]: durationSec, [XAPI_EXT.videoProgress]: Math.min(1, Math.round((rounded / durationSec) * 100) / 100) } : {}),
        },
      },
      { [XAPI_EXT.block]: blockIndex, [XAPI_EXT.session]: itemKey },
    );
  }
  return getResume(enrollmentId);
}

/** Saved in-video offset for a specific session (cross-device resume-seek). */
export async function getPosition(enrollmentId: string, blockIndex: number, itemKey: string) {
  await loadContext(enrollmentId); // validates existence
  const pos = await prisma.mediaPosition.findUnique({
    where: { enrollmentId_blockIndex_itemKey: { enrollmentId, blockIndex, itemKey } },
  });
  return { positionSec: pos?.positionSec ?? 0, durationSec: pos?.durationSec ?? null };
}

export async function getResume(enrollmentId: string) {
  const { enrollment, content } = await loadContext(enrollmentId);
  const target = computeResume(
    content, toRecords(enrollment.completions), Boolean(enrollment.momentAncrage),
    { blockIndex: enrollment.lastBlockIndex, itemKey: enrollment.lastItemKey },
  );
  // Enrich the resume target with its saved video offset (exact in-session spot).
  let positionSec = 0;
  let durationSec: number | null = null;
  if (target) {
    const pos = await prisma.mediaPosition.findUnique({
      where: { enrollmentId_blockIndex_itemKey: { enrollmentId, blockIndex: target.blockIndex, itemKey: target.itemKey } },
    });
    if (pos) { positionSec = pos.positionSec; durationSec = pos.durationSec; }
  }
  return { resume: target ? { ...target, positionSec, durationSec } : null, lastSeenAt: enrollment.lastSeenAt, status: enrollment.status };
}

export async function listXapi(enrollmentId: string) {
  await loadContext(enrollmentId);
  return prisma.xapiStatement.findMany({ where: { enrollmentId }, orderBy: { storedAt: "asc" } });
}

// --- rendering (PAM-injected) ----------------------------------------------

export async function renderBlock(enrollmentId: string, blockIndex: number) {
  const { enrollment, content } = await loadContext(enrollmentId);
  const block = content.blocks[blockIndex];
  if (!block) throw new EngineError(404, "no_block", "Bloc introuvable");

  const progress = computeProgress(content, toRecords(enrollment.completions), Boolean(enrollment.momentAncrage));
  const bp = progress.blocks[blockIndex]!;
  if (bp.state === "locked") {
    throw new EngineError(403, "block_locked", `Le bloc ${blockIndex} est verrouillé — terminez d'abord le bloc précédent`);
  }

  // Inject the Moment d'Ancrage everywhere in the block before rendering.
  const rendered = injectMomentAncrage(block, enrollment.momentAncrage);

  // Bloc 2 (PRACTICE) surfaces the learner's diagnostic priorities (2 weakest
  // sub-areas) as priority prompts at entry (Pilier 2).
  let diagnosticPriorities: unknown = undefined;
  if (block.type === "PRACTICE") {
    const diag = enrollment.completions.find((c) => c.blockIndex === 1 && c.itemKey === "diagnostic");
    const data = diag?.data as { priorities?: unknown } | null;
    if (data?.priorities) diagnosticPriorities = data.priorities;
  }
  return { state: bp.state, block: rendered, ...(diagnosticPriorities ? { diagnosticPriorities } : {}) };
}

export async function getEnrollment(enrollmentId: string) {
  return reconcile(enrollmentId);
}

/** Lightweight list of a learner's enrolments (for the PWA enrolment picker). */
export async function listEnrollmentsForUser(userId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: { courseVersion: { include: { course: true } }, completions: { select: { blockIndex: true, itemKey: true, scorePct: true } } },
    orderBy: { startedAt: "desc" },
  });
  return enrollments.map((e) => {
    const content = CourseContent.parse(e.courseVersion.content);
    const progress = computeProgress(content, toRecords(e.completions), Boolean(e.momentAncrage));
    return {
      id: e.id,
      status: e.status,
      course: { slug: e.courseVersion.course.slug, title: e.courseVersion.title, level: e.courseVersion.level },
      blocksTotal: content.blocks.length,
      blocksCompleted: progress.completedBlockIndexes.length,
      progressPercent: Math.round((progress.completedBlockIndexes.length / content.blocks.length) * 100),
      lastSeenAt: e.lastSeenAt,
      startedAt: e.startedAt,
    };
  });
}
