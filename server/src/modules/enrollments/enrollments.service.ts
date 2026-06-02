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
import { computeProgress, scoreQuiz, type CompletionRecord } from "../../domain/engine/progress.js";
import { injectMomentAncrage } from "../../domain/engine/injection.js";
import { badgeMessage, badgeTypeForBlock, peerNotificationText } from "../../domain/engine/badges.js";
import { computeResume } from "../../domain/engine/resume.js";
import { activityId, buildStatement, quizResult, type VerbKey } from "../../domain/engine/xapi.js";
import { enqueueNotification } from "../notifications/notifications.service.js";

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
) {
  const { enrollment } = ctx;
  const objectId = activityId(enrollment.course.slug, objectParts);
  const statement = buildStatement({
    actor: { name: enrollment.user.name, userId: enrollment.userId },
    verb, objectId, objectName, result, enrollmentId: enrollment.id,
  });
  await prisma.xapiStatement.create({
    data: { enrollmentId: enrollment.id, verb, objectId, statement: statement as unknown as Prisma.InputJsonValue },
  });
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

// --- Moment d'Ancrage -------------------------------------------------------

export async function captureMomentAncrage(enrollmentId: string, text: string) {
  const { content } = await loadContext(enrollmentId);
  const onboarding = content.blocks.find((b) => b.type === "ONBOARDING");
  const minChars = onboarding?.type === "ONBOARDING" ? onboarding.payload.momentAncrage.minChars : 50;
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

export async function designatePeer(enrollmentId: string, name: string, email: string) {
  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { peerName: name, peerEmail: email } });
  await upsertCompletion(enrollmentId, 0, "PEER", "peer", null, { name, email });
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

export async function completeItem(
  enrollmentId: string, blockIndex: number, itemType: ItemType, itemKey: string, data?: unknown,
) {
  const ctx = await loadContext(enrollmentId); // validates existence
  assertUnlocked(ctx, blockIndex);
  await upsertCompletion(enrollmentId, blockIndex, itemType, itemKey, null, data ?? null);
  await touch(enrollmentId, blockIndex, itemKey);
  await emitXapi(ctx, "completed", [`blocks/${blockIndex}`, `items/${itemKey}`], `${itemType} ${itemKey}`);
  return reconcile(enrollmentId);
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
export async function submitInterBlockQuiz(enrollmentId: string, answers: Record<string, string>) {
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
  await emitXapi(ctx, "completed", [`blocks/${block.index}`, "items/interblock"], "Quiz interbloc");
  return { ...(await reconcile(enrollmentId)), quiz: { correct, total, scored: false } };
}

/** Diagnostic quiz (Bloc 1) — scored on /N, mapped to a profile band. */
export async function submitDiagnosticQuiz(enrollmentId: string, answers: Record<string, string>) {
  const ctx = await loadContext(enrollmentId);
  const block = ctx.content.blocks.find((b) => b.type === "COMPREHENSION");
  if (block?.type !== "COMPREHENSION") throw new EngineError(409, "no_block", "Bloc 1 absent");
  assertUnlocked(ctx, block.index);
  const qs = block.payload.diagnosticQuiz.questions;
  const { scorePct, correct, total } = scoreQuiz(qs, answers);
  const band = block.payload.diagnosticQuiz.profiles.find(
    (p) => correct >= p.scoreRange[0] && correct <= p.scoreRange[1],
  );
  await upsertCompletion(enrollmentId, block.index, "DIAGNOSTIC_QUIZ", "diagnostic", scorePct, {
    answers, correct, total, profile: band?.name ?? null,
  });
  await touch(enrollmentId, block.index, "diagnostic");
  await emitXapi(ctx, "completed", [`blocks/${block.index}`, "items/diagnostic"], "Quiz diagnostique", quizResult(scorePct, correct, total));
  return { ...(await reconcile(enrollmentId)), quiz: { scorePct, correct, total, profile: band?.name ?? null } };
}

/** Final quiz (Bloc 3) — scored; gates Bloc 4 via the pass threshold. */
export async function submitFinalQuiz(enrollmentId: string, answers: Record<string, string>) {
  const ctx = await loadContext(enrollmentId);
  const block = ctx.content.blocks.find((b) => b.type === "ANCHORING");
  if (block?.type !== "ANCHORING") throw new EngineError(409, "no_block", "Bloc 3 absent");
  assertUnlocked(ctx, block.index);
  const qs = block.payload.finalQuiz.questions;
  const { scorePct, correct, total } = scoreQuiz(qs, answers);
  const threshold = block.payload.finalQuiz.passThreshold;
  await upsertCompletion(enrollmentId, block.index, "FINAL_QUIZ", "final", scorePct, { answers, correct, total });
  await touch(enrollmentId, block.index, "final");
  const passed = scorePct >= threshold;
  await emitXapi(ctx, passed ? "passed" : "failed", [`blocks/${block.index}`, "items/final"], "Quiz final", quizResult(scorePct, correct, total, threshold));
  return { ...(await reconcile(enrollmentId)), quiz: { scorePct, correct, total, passed, threshold } };
}

/** Human evaluator records the Bloc 4 rubric score (gates the certificate). */
export async function recordRubricEvaluation(enrollmentId: string, scorePct: number, notes?: string) {
  const ctx = await loadContext(enrollmentId);
  const block = ctx.content.blocks.find((b) => b.type === "CERTIFICATION");
  if (block?.type !== "CERTIFICATION") throw new EngineError(409, "no_block", "Bloc 4 absent");
  assertUnlocked(ctx, block.index);
  const threshold = block.payload.rubric.threshold;
  await upsertCompletion(enrollmentId, block.index, "RUBRIC_EVALUATION", "rubric", scorePct, { notes: notes ?? null });
  await emitXapi(ctx, scorePct >= threshold ? "passed" : "failed", [`blocks/${block.index}`, "items/rubric"], "Évaluation grille", quizResult(scorePct, scorePct, 100, threshold));
  return reconcile(enrollmentId);
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
    await prisma.badge.create({
      data: { enrollmentId, type, message, peerNotified: Boolean(enrollment.peerEmail) },
    });
    // Peer notification (Pilier 6.3) — enqueued for delivery by the dispatcher.
    if (enrollment.peerEmail) {
      await enqueueNotification({
        enrollmentId, recipientKind: "PEER", recipient: enrollment.peerEmail, channel: "EMAIL",
        subject: `${enrollment.user.name} a obtenu un badge 🏅`,
        body: peerNotificationText(enrollment.peerName, enrollment.user.name, block.badge.label),
        provider: "engine",
      });
    }
    await emitXapi(ctx, "earned", [`blocks/${idx}`, `badges/${type}`], block.badge.label);
    newlyIssued.push({ type, message });
  }

  // Course completion → CERTIFIED.
  if (progress.courseCompleted && enrollment.status !== "CERTIFIED") {
    await prisma.enrollment.update({
      where: { id: enrollmentId }, data: { status: "CERTIFIED", completedAt: new Date() },
    });
    await emitXapi(ctx, "passed", [], content.certificate.title, { completion: true, success: true });
  }

  const badges = await prisma.badge.findMany({ where: { enrollmentId }, orderBy: { issuedAt: "asc" } });
  return { progress, badges, newlyIssued, momentAncrageCaptured: Boolean(enrollment.momentAncrage) };
}

// --- auto-resume + position (Pilier 6.2) ------------------------------------

export async function savePosition(enrollmentId: string, blockIndex: number, itemKey: string) {
  await loadContext(enrollmentId);
  await touch(enrollmentId, blockIndex, itemKey);
  return getResume(enrollmentId);
}

export async function getResume(enrollmentId: string) {
  const { enrollment, content } = await loadContext(enrollmentId);
  const target = computeResume(
    content, toRecords(enrollment.completions), Boolean(enrollment.momentAncrage),
    { blockIndex: enrollment.lastBlockIndex, itemKey: enrollment.lastItemKey },
  );
  return { resume: target, lastSeenAt: enrollment.lastSeenAt, status: enrollment.status };
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
  return { state: bp.state, block: rendered };
}

export async function getEnrollment(enrollmentId: string) {
  return reconcile(enrollmentId);
}
