/**
 * enrollments.service.ts — the learner-side runtime engine.
 *
 * Orchestrates: enrolment in a published version → Moment d'Ancrage capture →
 * progress recording (with quiz scoring) → block gating recomputation → badge
 * issuance (PAM-anchored, peer-notified) → PAM-injected block rendering.
 */
import { Prisma, type ItemType } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { materializeQuiz } from "../bank/bank.service.js";
import { CourseContent, profileDivergence, type CourseContent as CourseContentT, type ScoredQuestion } from "../../domain/content-model.js";
import { computeProgress, scoreQuiz, diagnosticProfile, projectSectionKey, PROJECT_FINAL_SECTION_KEY, type CompletionRecord } from "../../domain/engine/progress.js";
import { composeJournalChapter, journalUnlockAt } from "../../domain/engine/project.js";
import { journalRecap } from "../../domain/engine/journal.js";
import { bandOf, decideCertification } from "../../domain/engine/certification.js";
import { accreditedEvaluatorIds, activeAccreditation } from "../accreditations/accreditations.service.js";
import { injectMomentAncrage } from "../../domain/engine/injection.js";
import { badgeMessage, badgeTypeForBlock, peerNotificationText } from "../../domain/engine/badges.js";
import { computeResume } from "../../domain/engine/resume.js";
import { SLA_TURNAROUND_BUSINESS_DAYS } from "../../domain/engine/sla.js";
import { hasPermission } from "../../domain/auth/permissions.js";
import { activityId, buildStatement, quizResult, secondsToIsoDuration, XAPI_EXT, type VerbKey } from "../../domain/engine/xapi.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import { issueCredential, certificate as certificatePdfOf } from "../credentials/credentials.service.js";
import { credentialUrl } from "../../lib/credentials/openbadge.js";
import { sendSmtpEmail, smtpConfigured } from "../../lib/notify/email.js";
import { dispatchEvent } from "../../lib/webhooks/webhooks.js";
import { audit } from "../../lib/audit.js";
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

/**
 * Admin action — re-point an enrolment to the latest PUBLISHED course version
 * (so newly-linked videos / edits become visible), without deleting the account.
 * `mode: "version"` keeps progress; `mode: "full"` wipes all progress first.
 */
export async function resetEnrollment(actorId: string | undefined, enrollmentId: string, mode: "full" | "version") {
  const e = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, select: { id: true, courseId: true } });
  if (!e) throw new EngineError(404, "not_found", "Inscription introuvable");
  const latest = await prisma.courseVersion.findFirst({
    where: { courseId: e.courseId, status: "PUBLISHED" }, orderBy: { version: "desc" }, select: { id: true, version: true },
  });
  if (!latest) throw new EngineError(409, "no_published_version", "Aucune version publiée pour ce cours");

  if (mode === "version") {
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { courseVersionId: latest.id } });
    await audit({ actorId, action: "enrollment.version_updated", targetType: "enrollment", targetId: enrollmentId, meta: { version: latest.version } });
    return { mode, version: latest.version };
  }

  // Full reset: drop every progress artefact, then re-pin to the latest version.
  await prisma.$transaction([
    prisma.itemCompletion.deleteMany({ where: { enrollmentId } }),
    prisma.journalTrigger.deleteMany({ where: { enrollmentId } }),
    prisma.mediaPosition.deleteMany({ where: { enrollmentId } }),
    prisma.badge.deleteMany({ where: { enrollmentId } }),
    prisma.reEngagementMessage.deleteMany({ where: { enrollmentId } }),
    prisma.credential.deleteMany({ where: { enrollmentId } }),
    prisma.aiAssessment.deleteMany({ where: { enrollmentId } }),
    prisma.xapiStatement.deleteMany({ where: { enrollmentId } }),
    prisma.notification.deleteMany({ where: { enrollmentId } }),
    prisma.syncOperation.deleteMany({ where: { enrollmentId } }),
    prisma.tutorSession.deleteMany({ where: { enrollmentId } }),
    prisma.projectSubmission.deleteMany({ where: { enrollmentId } }),
    prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { courseVersionId: latest.id, status: "ACTIVE", momentAncrage: null, peerName: null, peerEmail: null, peerPhone: null, lastBlockIndex: null, lastItemKey: null, lastSeenAt: new Date(), journalStartedAt: null, completedAt: null },
    }),
  ]);
  await audit({ actorId, action: "enrollment.reset", targetType: "enrollment", targetId: enrollmentId, meta: { version: latest.version } });
  return { mode, version: latest.version };
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

export async function designatePeer(enrollmentId: string, name: string, email: string, phone?: string, consent?: boolean) {
  // Consentement recueilli AU MOMENT de la désignation (Pilier 6.3) : sans lui,
  // le pair est nommé mais ne reçoit aucune notification de progression.
  const peerConsent = consent ?? true;
  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { peerName: name, peerEmail: email, peerPhone: phone ?? null, peerConsent } });
  await upsertCompletion(enrollmentId, 0, "PEER", "peer", null, { name, email, phone: phone ?? null, consent: peerConsent });
  await touch(enrollmentId, 0, "peer");
  return reconcile(enrollmentId);
}

// --- cohort board (Pilier 6.3) ----------------------------------------------

/** Tableau de progression de cohorte ANONYMISÉ (K-HCBLM v2.2, Pilier 6.3) :
 *  l'apprenant inscrit dans un groupe voit la progression agrégée de sa
 *  cohorte « sans identifier les individus » — effectif, répartition par
 *  nombre de blocs complétés (badges), complétion moyenne, certifiés.
 *  Aucun nom, aucun e-mail, aucun identifiant de membre ne sort d'ici. */
export async function cohortBoard(enrollmentId: string) {
  const e = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!e) throw new EngineError(404, "not_found", "Inscription introuvable");
  const membership = await prisma.cohortMembership.findFirst({
    where: { userId: e.userId, cohort: { OR: [{ courseId: e.courseId }, { courseId: null }] } },
    include: { cohort: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!membership) return { cohort: null, board: null };
  const memberIds = (await prisma.cohortMembership.findMany({
    where: { cohortId: membership.cohortId }, select: { userId: true },
  })).map((m) => m.userId);
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: { in: memberIds }, courseId: e.courseId },
    select: { badges: { select: { type: true } } },
  });
  // 0..5 blocs complétés (5 = certifié) — un badge par bloc, plafonné à 5.
  const distribution = [0, 0, 0, 0, 0, 0];
  let certified = 0, sum = 0;
  for (const en of enrollments) {
    const n = Math.min(en.badges.length, 5);
    distribution[n]!++;
    sum += n / 5;
    if (en.badges.some((b) => b.type === "CERTIFICATE")) certified++;
  }
  return {
    cohort: { id: membership.cohort.id, name: membership.cohort.name },
    board: {
      members: enrollments.length,
      distribution,
      avgPct: enrollments.length === 0 ? 0 : Math.round((sum / enrollments.length) * 100),
      certified,
    },
  };
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

// --- frozen results (première soumission = définitive) -----------------------
// Once completed, an exercise/quiz shows its recorded answers read-only: a
// re-submission would bias the course outcome after the feedback was seen.
// The rule is enforced HERE (not only in the UI) so the offline queue cannot
// bypass it; frozen re-submissions are idempotent no-ops (never errors), so a
// replayed queue entry resolves normally instead of sticking in retry.
// Deliberately NOT frozen:
//  - PROJECT sections (progressive Bloc 4: sections stay editable until the
//    final section assembles the whole project);
//  - the FINAL quiz while below its pass threshold (the learner MUST retake
//    it to unlock Bloc 4 — freezing a failed attempt would block the course);
//  - PEER / PROFILE / PAM (idempotent identity data), video positions.
const FROZEN_ITEM_TYPES: ItemType[] = [
  "MICRO_SESSION", "CASE_STUDY", "GUIDED_SCENARIOS", "FIELD_APPLICATION",
  "SELF_ASSESSMENT", "ACTION_PLAN", "JOURNAL_ENTRY",
];

function completionOf(ctx: Awaited<ReturnType<typeof loadContext>>, blockIndex: number, itemKey: string) {
  return ctx.enrollment.completions.find((c) => c.blockIndex === blockIndex && c.itemKey === itemKey);
}

/** Every stored completion with its raw answers — powers the read-only recap
 *  screens (frozen results) in the learner PWA. */
export async function listAnswers(enrollmentId: string) {
  return prisma.itemCompletion.findMany({
    where: { enrollmentId },
    orderBy: [{ blockIndex: "asc" }, { completedAt: "asc" }],
    select: { blockIndex: true, itemType: true, itemKey: true, scorePct: true, completedAt: true, data: true },
  });
}

/** Plain text of a stored section/deliverable payload. */
function textOfData(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (data && typeof data === "object" && typeof (data as { text?: unknown }).text === "string") return ((data as { text: string }).text).trim();
  return "";
}

/**
 * Progressive Bloc 4 (« Amélioration » — déblocage séquentiel) :
 *  - a journal micro-entry opens only once its J+n date is reached, `n` days
 *    after the completion of micro-session 4.3 (the notification schedule) ;
 *  - Section 5 (the final micro-session) opens after sections 1–3. The journal
 *    NEVER gates the final submission (K-HCBLM v2.2, Pilier 5 : « la plateforme
 *    ne bloque jamais la soumission d'un journal incomplet ») — missing entries
 *    are sanctioned by rubric criterion S1, not by a technical lock.
 * Server-enforced so the offline queue can never bypass the sequence.
 */
function assertBloc4ItemUnlocked(ctx: Awaited<ReturnType<typeof loadContext>>, blockIndex: number, itemType: ItemType, itemKey: string) {
  const cert = ctx.content.blocks.find((b) => b.type === "CERTIFICATION");
  if (cert?.type !== "CERTIFICATION" || blockIndex !== cert.index) return;
  const done = new Set(ctx.enrollment.completions.filter((c) => c.blockIndex === blockIndex).map((c) => c.itemKey));

  if (itemType === "JOURNAL_ENTRY") {
    const day = Number(/^J\+(\d+)$/.exec(itemKey)?.[1] ?? Number.NaN);
    if (Number.isNaN(day)) return;
    const started = ctx.enrollment.journalStartedAt;
    if (!started) {
      throw new EngineError(423, "journal_locked", "Le journal des 2 semaines s'ouvre après la micro-session 4.3 (Section 3).");
    }
    const unlockAt = journalUnlockAt(started, day);
    if (Date.now() < unlockAt.getTime()) {
      throw new EngineError(423, "journal_locked", `La micro-entrée J+${day} s'ouvrira le ${unlockAt.toLocaleDateString("fr-FR")} — vous serez notifié·e.`);
    }
  }

  if (itemType === "PROJECT" && itemKey === PROJECT_FINAL_SECTION_KEY) {
    const missingSections = [0, 1, 2].map(projectSectionKey).filter((k) => !done.has(k));
    if (missingSections.length > 0) {
      throw new EngineError(423, "section_locked", "La Section 5 s'ouvre après les sections 1 à 3.");
    }
  }
}

/** Assemble the full certification project from the per-section completions:
 *  sections 1–3 (stored), the auto-composed journal chapter (Section 4,
 *  750–850 caractères) and the just-submitted Section 5. */
function assembleProjectContent(ctx: Awaited<ReturnType<typeof loadContext>>, blockIndex: number, finalData: unknown) {
  const cert = ctx.content.blocks.find((b) => b.type === "CERTIFICATION");
  if (cert?.type !== "CERTIFICATION") return { text: textOfData(finalData) };
  const byKey = new Map(ctx.enrollment.completions.filter((c) => c.blockIndex === blockIndex).map((c) => [c.itemKey, c] as const));
  const journalTexts = cert.payload.journal.entries
    .map((e) => ({ day: e.day, text: textOfData(byKey.get(`J+${e.day}`)?.data) }))
    .filter((e) => e.text);
  const section4 = composeJournalChapter(journalTexts);
  const parts = cert.payload.sections.map((sec, i) => ({
    title: sec.title,
    text: i === 3 ? section4 : i === 4 ? textOfData(finalData) : textOfData(byKey.get(projectSectionKey(i))?.data),
  }));
  // `sections` stays a { title → text } record — the evaluator console and the
  // rubric-suggestion reader both consume that historical shape.
  return {
    sections: Object.fromEntries(parts.map((sec) => [sec.title, sec.text])),
    section4,
    text: parts.map((sec) => `${sec.title}\n${sec.text}`).join("\n\n"),
  };
}

export async function completeItem(
  enrollmentId: string, blockIndex: number, itemType: ItemType, itemKey: string, data?: unknown, meta: ExerciseMeta = {},
) {
  const ctx = await loadContext(enrollmentId); // validates existence
  assertUnlocked(ctx, blockIndex);
  assertBloc4ItemUnlocked(ctx, blockIndex, itemType, itemKey);
  // Frozen: the first submission is final — a revisit is a no-op that leaves
  // the recorded answers untouched (results stay consultable, never rewritten).
  if (FROZEN_ITEM_TYPES.includes(itemType) && completionOf(ctx, blockIndex, itemKey)) {
    await touch(enrollmentId, blockIndex, itemKey);
    return reconcile(enrollmentId);
  }
  const hasMeta = meta.timeMs != null || meta.feedbackViewed != null || meta.response != null || meta.correct != null;
  await upsertCompletion(enrollmentId, blockIndex, itemType, itemKey, null, data ?? null);
  // Bloc 4 project (progressive): sections 1–3 and 5 are their own completions;
  // ONLY the final section (Section 5) assembles the whole project — the four
  // typed sections + the journal chapter (auto-composed Section 4) — and opens
  // the certification-project record for human evaluation (starts the SLA clock).
  if (itemType === "PROJECT" && itemKey === PROJECT_FINAL_SECTION_KEY) {
    const assembled = assembleProjectContent(ctx, blockIndex, data);
    await prisma.projectSubmission.upsert({
      where: { enrollmentId },
      update: { submittedAt: new Date(), content: assembled as Prisma.InputJsonValue, revisionStatus: "SUBMITTED", slaAlertedAt: null },
      create: { enrollmentId, blockIndex, content: assembled as Prisma.InputJsonValue },
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
export async function assignEvaluator(enrollmentId: string, evaluatorId: string, opts: { f2fConflict?: boolean } = {}) {
  const submission = await prisma.projectSubmission.findUnique({ where: { enrollmentId } });
  if (!submission) throw new EngineError(409, "no_submission", "Aucun projet soumis pour cette inscription");
  const evaluator = await prisma.user.findUnique({ where: { id: evaluatorId } });
  if (!evaluator) throw new EngineError(404, "no_evaluator", "Évaluateur introuvable");
  if (!hasPermission(evaluator.role, "evaluation:grade")) {
    throw new EngineError(422, "not_evaluator", `${evaluator.name} ne peut pas évaluer (rôle ${evaluator.role})`);
  }
  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw new EngineError(404, "not_found", "Inscription introuvable");

  // --- Habilitation (socle §9.2) : « aucun évaluateur ne note un dossier réel
  //     avant d'avoir passé ce test » — active, sur CE parcours. La remise est
  //     réassignée au même évaluateur : elle passe par la même garde.
  const accreditation = await activeAccreditation(evaluatorId, enrollment.courseId);
  if (!accreditation) {
    throw new EngineError(409, "not_accredited", `${evaluator.name} n'est pas habilité·e sur ce parcours (calibration §9.2 requise, validité 12 mois)`);
  }

  // --- Incompatibilités (socle §5.1) — appliquées à l'ASSIGNATION, pas à la
  //     déclaration. Les trois premières sont détectées en base ; le lien
  //     FACE2FACE fait l'objet d'une déclaration tant que le rapprochement
  //     entre les deux systèmes n'est pas automatisé.
  if (opts.f2fConflict) {
    throw new EngineError(409, "incompat_face2face", `${evaluator.name} a animé une session FACE2FACE suivie par ce candidat sur la même compétence — dossier à réassigner`);
  }
  // (1) il est le pair de progression désigné par le candidat.
  if (enrollment.peerEmail && evaluator.email.trim().toLowerCase() === enrollment.peerEmail.trim().toLowerCase()) {
    throw new EngineError(409, "incompat_peer", `${evaluator.name} est le pair de progression désigné par ce candidat`);
  }
  // (2) il a conduit une relance individuelle (Pilier 6.4) — tracée à l'audit.
  const nudged = await prisma.auditLog.count({
    where: { action: "enrollment.nudge", actorId: evaluatorId, targetId: enrollmentId },
  });
  if (nudged > 0) {
    throw new EngineError(409, "incompat_relance", `${evaluator.name} a conduit une relance individuelle auprès de ce candidat`);
  }
  // (3) même organisation que le candidat (lien hiérarchique possible).
  const sharedOrg = await prisma.organizationMembership.findFirst({
    where: {
      userId: evaluatorId,
      organization: { memberships: { some: { userId: enrollment.userId } } },
    },
  });
  if (sharedOrg) {
    throw new EngineError(409, "incompat_org", `${evaluator.name} appartient à la même organisation que ce candidat`);
  }

  // --- Rotation (socle §5.1) : ≤ 60 % des dossiers du parcours sur le
  //     trimestre calendaire. Mesurable dès 2 évaluateurs habilités et un
  //     volume suffisant (< 5 dossiers/trimestre, l'écart ne se mesure pas —
  //     même logique que la double notation du §9.3).
  const accredited = await accreditedEvaluatorIds(enrollment.courseId);
  if (accredited.length >= 2) {
    const q = Math.floor(new Date().getMonth() / 3);
    const quarterStart = new Date(new Date().getFullYear(), q * 3, 1);
    const assigned = await prisma.projectSubmission.findMany({
      where: { enrollment: { courseId: enrollment.courseId }, assignedAt: { gte: quarterStart }, evaluatorId: { not: null } },
      select: { enrollmentId: true, evaluatorId: true },
    });
    const others = assigned.filter((a) => a.enrollmentId !== enrollmentId);
    const resultingTotal = others.length + 1;
    const resultingCount = others.filter((a) => a.evaluatorId === evaluatorId).length + 1;
    if (resultingTotal >= 5 && resultingCount / resultingTotal > 0.6) {
      throw new EngineError(409, "rotation_exceeded", `${evaluator.name} dépasserait 60 % des dossiers de ce parcours sur le trimestre (${resultingCount}/${resultingTotal}) — assigner un autre évaluateur habilité`);
    }
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
      enrollment: {
        include: {
          user: { select: { name: true, email: true } },
          courseVersion: { select: { title: true, content: true } },
          completions: { where: { itemType: "JOURNAL_ENTRY" }, select: { itemKey: true, completedAt: true } },
        },
      },
    },
  });
  return subs.map((s) => {
    const content = s.enrollment.courseVersion.content as { blocks?: { type: string; payload?: { rubric?: unknown; journal?: { entries?: { day: number }[] } } }[] } | null;
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
      // Part calculée par la plateforme du critère S1 (socle §3) : décompte,
      // dates de saisie et détection du rattrapage groupé — l'évaluateur ne
      // relit pas le calendrier, il note le signal de surcharge et l'ajustement.
      journal: journalRecap(b4?.payload?.journal?.entries ?? [], s.enrollment.completions),
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
  // Profile choice and trigger quiz are now two distinct learner moments (the
  // quiz plays AFTER the trigger video, inside the Bloc 0 second session): each
  // completion is recorded only when its data is actually present.
  // Frozen: an already-recorded trigger quiz / profile is never overwritten.
  if (completionOf(ctx, 0, "trigger")) answers = {};
  if (profileKey && completionOf(ctx, 0, "profile")) profileKey = undefined;
  if (Object.keys(answers).length > 0) {
    await upsertCompletion(enrollmentId, 0, "TRIGGER_QUIZ", "trigger", null, { answers, profileKey: profileKey ?? null });
    await touch(enrollmentId, 0, "trigger");
    await emitXapi(ctx, "completed", ["blocks/0", "items/trigger"], "Quiz déclencheur");
  }
  if (profileKey) {
    await upsertCompletion(enrollmentId, 0, "PROFILE", "profile", null, { profileKey });
    if (Object.keys(answers).length === 0) await touch(enrollmentId, 0, "profile");
  }
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
  // Frozen: already submitted — return the recorded result, never re-score.
  const doneIb = completionOf(ctx, block.index, "interblock");
  if (doneIb) {
    const d = doneIb.data as { correct?: number; total?: number } | null;
    return { ...(await reconcile(enrollmentId)), quiz: { correct: d?.correct ?? 0, total: d?.total ?? 0, scored: false, frozen: true } };
  }
  const qs = await materializeQuiz(enrollmentId, "interblock", block.payload.interBlockQuiz) as ScoredQuestion[];
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
  // Frozen: the diagnostic is a one-shot photograph of the entry level — a
  // retake after seeing the answers would bias the whole course reporting.
  const doneDg = completionOf(ctx, block.index, "diagnostic");
  if (doneDg) {
    const d = (doneDg.data ?? {}) as Record<string, unknown>;
    return {
      ...(await reconcile(enrollmentId)),
      quiz: {
        scorePct: doneDg.scorePct ?? 0, correct: (d.correct as number) ?? 0, total: (d.total as number) ?? 0,
        profile: (d.profile as string | null) ?? null, subAreaScores: d.subAreaScores ?? [], priorities: (d.priorities as string[]) ?? [],
        divergence: (d.divergence as object | null) ?? null,
        frozen: true,
      },
    };
  }
  const qs = await materializeQuiz(enrollmentId, "diagnostic", block.payload.diagnosticQuiz) as ScoredQuestion[];
  const { scorePct, correct, total, subAreaScores, priorities } = diagnosticProfile(qs, answers);
  const band = block.payload.diagnosticQuiz.profiles.find(
    (p) => correct >= p.scoreRange[0] && correct <= p.scoreRange[1],
  );
  // Pilier 2 (v2.2) : le diagnostic fait autorité — quand il s'écarte du profil
  // auto-déclaré du Bloc 0, l'écart est énoncé explicitement (jamais tu).
  const onboarding = ctx.content.blocks.find((b) => b.type === "ONBOARDING");
  const selfKey = ((completionOf(ctx, 0, "profile")?.data ?? {}) as { profileKey?: string }).profileKey;
  const selfChoice = onboarding?.type === "ONBOARDING" && selfKey
    ? onboarding.payload.profileChoices.find((c) => c.key === selfKey) ?? null : null;
  const divergence = profileDivergence(selfChoice, band?.name ?? null);
  // Competency entry profile: 2 weakest sub-areas framed as priorities (Pilier 2).
  await upsertCompletion(enrollmentId, block.index, "DIAGNOSTIC_QUIZ", "diagnostic", scorePct, {
    answers, correct, total, profile: band?.name ?? null, subAreaScores, priorities, divergence,
  });
  await touch(enrollmentId, block.index, "diagnostic");
  await emitQuestionStatements(ctx, block.index, "diagnostic", qs, answers, meta);
  await emitXapi(ctx, "completed", [`blocks/${block.index}`, "items/diagnostic"], "Quiz diagnostique", quizResult(scorePct, correct, total));
  return {
    ...(await reconcile(enrollmentId)),
    quiz: { scorePct, correct, total, profile: band?.name ?? null, subAreaScores, priorities, divergence },
  };
}

/** Final quiz (Bloc 3) — scored; gates Bloc 4 via the pass threshold. */
export async function submitFinalQuiz(enrollmentId: string, answers: Record<string, string>, meta: QuestionMeta = {}) {
  const ctx = await loadContext(enrollmentId);
  const block = ctx.content.blocks.find((b) => b.type === "ANCHORING");
  if (block?.type !== "ANCHORING") throw new EngineError(409, "no_block", "Bloc 3 absent");
  assertUnlocked(ctx, block.index);
  const threshold0 = block.payload.finalQuiz.passThreshold;
  // Frozen ONLY once passed: a failed attempt (below threshold) must stay
  // retakable, otherwise Bloc 4 would be locked forever.
  const doneFq = completionOf(ctx, block.index, "final");
  if (doneFq && (doneFq.scorePct ?? 0) >= threshold0) {
    const d = (doneFq.data ?? {}) as Record<string, unknown>;
    return {
      ...(await reconcile(enrollmentId)),
      quiz: { scorePct: doneFq.scorePct ?? 0, correct: (d.correct as number) ?? 0, total: (d.total as number) ?? 0, passed: true, threshold: threshold0, frozen: true },
    };
  }
  const qs = await materializeQuiz(enrollmentId, "final", block.payload.finalQuiz) as ScoredQuestion[];
  const { scorePct, correct, total } = scoreQuiz(qs, answers);
  const threshold = threshold0;
  await upsertCompletion(enrollmentId, block.index, "FINAL_QUIZ", "final", scorePct, { answers, correct, total });
  await touch(enrollmentId, block.index, "final");
  await emitQuestionStatements(ctx, block.index, "final", qs, answers, meta);
  const passed = scorePct >= threshold;
  await emitXapi(ctx, passed ? "passed" : "failed", [`blocks/${block.index}`, "items/final"], "Quiz final", quizResult(scorePct, correct, total, threshold));
  return { ...(await reconcile(enrollmentId)), quiz: { scorePct, correct, total, passed, threshold } };
}

export type RubricEvaluationInput = {
  /** Per-criterion points (preferred): the platform computes the weighted total.
   *  `evidence` = preuve du socle (règle 3) : citation exacte du dossier ou,
   *  pour une bande basse, déclaration des sections parcourues et de ce qui
   *  n'y figure pas. OBLIGATOIRE sur une grille à bandes. */
  criteria?: { label?: string; index?: number; points: number; evidence?: string }[];
  /** Legacy single total (still accepted — grilles plates uniquement). */
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
  const banded = rubric.criteria.some((rc) => rc.bands?.length);

  // Habilitation (socle §9.2) : le notateur doit détenir une habilitation
  // ACTIVE sur ce parcours — quel que soit son rôle.
  if (gradedBy) {
    const acc = await activeAccreditation(gradedBy, ctx.enrollment.courseId);
    if (!acc) throw new EngineError(403, "not_accredited", "Notation refusée : habilitation active requise sur ce parcours (calibration §9.2, validité 12 mois)");
  }

  let scorePct: number;
  let breakdown: { label: string; weightPoints: number; points: number; band?: number | null; evidence?: string | null }[] | null = null;
  let decision: ReturnType<typeof decideCertification> | null = null;
  if (input.criteria?.length) {
    breakdown = rubric.criteria.map((rc, i) => {
      const given = input.criteria!.find((c) => c.index === i || c.label?.trim().toLowerCase() === rc.label.trim().toLowerCase());
      const points = Math.max(0, Math.min(rc.weightPoints, Math.round(given?.points ?? 0)));
      // Socle, règle 3 : « Un critère sans preuve reportée n'est pas noté et le
      // dossier repart en évaluation. » — bloquant sur une grille à bandes.
      if (banded && !given?.evidence?.trim()) {
        throw new EngineError(422, "missing_evidence", `Preuve requise pour « ${rc.label} » : citation exacte du dossier ou, pour une bande basse, déclaration des sections parcourues (règle 3 du socle)`);
      }
      return { label: rc.label, weightPoints: rc.weightPoints, points, band: bandOf(rc, points), evidence: given?.evidence?.trim() ?? null };
    });
    scorePct = breakdown.reduce((a, b) => a + b.points, 0); // weighted total (rubric = 100)
    // Décision du socle §6 (conditions exclusives, les minimums priment).
    decision = decideCertification(rubric.criteria, breakdown.map((b) => ({ points: b.points })), threshold);
  } else if (input.scorePct != null) {
    if (banded) throw new EngineError(422, "criteria_required", "Cette grille se note PAR BANDE : fournir criteria[] avec points et preuve par critère");
    scorePct = Math.max(0, Math.min(100, Math.round(input.scorePct)));
  } else {
    throw new EngineError(422, "missing_score", "Fournir criteria[] (par critère) ou scorePct");
  }

  // Sans grille à bandes (héritage) : décision binaire seuil — mappée sur les
  // deux états historiques.
  const verdict = decision?.decision ?? (scorePct >= threshold ? "CERTIFIED" : "RESUBMIT");
  const passed = verdict === "CERTIFIED";
  // Le RUBRIC_EVALUATION ne « passe » (et n'émet le certificat) que sur
  // décision CERTIFIÉ — un total ≥ seuil avec un minimum manqué reste en remise.
  await upsertCompletion(enrollmentId, block.index, "RUBRIC_EVALUATION", "rubric", passed ? scorePct : Math.min(scorePct, threshold - 1), {
    notes: input.notes ?? null, criteria: breakdown, decision: verdict,
    minimumsMissed: decision?.minimumsMissed ?? [], scoreTotal: scorePct,
  });

  const STATUS: Record<string, "PASSED" | "REVISION_REQUESTED" | "NOT_CERTIFIED"> = {
    CERTIFIED: "PASSED", RESUBMIT: "REVISION_REQUESTED", NOT_CERTIFIED: "NOT_CERTIFIED",
  };
  const missedTxt = decision?.minimumsMissed.length
    ? `\n\nMinimum(s) non atteint(s) : ${decision.minimumsMissed.map((m) => `${m.label} (${m.points}/${m.minPoints})`).join(" · ")}`
    : "";

  // Close the project lifecycle on the submission record (stops the SLA clock,
  // freezes the verification metadata — grid version archived for audit) and
  // notify the learner of the result.
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
        revisionStatus: STATUS[verdict],
        decision: verdict,
        gridVersion: `v${ctx.enrollment.courseVersion.version} (${ctx.enrollment.courseVersionId})`,
      },
    });
    const subject = verdict === "CERTIFIED" ? "Projet de certification validé 🎉"
      : verdict === "RESUBMIT" ? "Projet de certification — remise demandée"
      : "Projet de certification — non certifié";
    const body = verdict === "CERTIFIED"
      ? `Félicitations ! Votre projet a obtenu ${scorePct}/100 (seuil ${threshold}).${missedTxt}${input.notes ? `\n\nRetour de l'évaluateur :\n${input.notes}` : ""}`
      : verdict === "RESUBMIT"
        ? `Votre projet a obtenu ${scorePct}/100 (seuil ${threshold}). Une remise unique est possible dans les 30 jours — elle sera revue par le même évaluateur.${missedTxt}${input.notes ? `\n\nRetour de l'évaluateur :\n${input.notes}` : ""}`
        : `Votre projet a obtenu ${scorePct}/100 (seuil ${threshold}) et n'est pas certifiable en l'état. Une reprise des Blocs 2 ou 3 est conseillée avant une nouvelle soumission.${missedTxt}${input.notes ? `\n\nRetour de l'évaluateur :\n${input.notes}` : ""}`;
    await enqueueNotification({
      enrollmentId, recipientKind: "LEARNER", recipient: ctx.enrollment.user.email,
      subject, body, provider: "project",
    });
  }

  await emitXapi(ctx, passed ? "passed" : "failed", [`blocks/${block.index}`, "items/rubric"], "Évaluation grille", quizResult(scorePct, scorePct, 100, threshold));
  return { ...(await reconcile(enrollmentId)), evaluation: { scorePct, threshold, passed, breakdown, decision: verdict, minimumsMissed: decision?.minimumsMissed ?? [] } };
}

// --- reconciliation: recompute progress + issue badges ----------------------

export async function reconcile(enrollmentId: string) {
  const ctx = await loadContext(enrollmentId);
  const { enrollment, content } = ctx;
  const progress = computeProgress(content, toRecords(enrollment.completions), Boolean(enrollment.momentAncrage));

  const existingBadgeTypes = new Set(enrollment.badges.map((b) => b.type));
  const newlyIssued: { type: string; message: string }[] = [];

  // Restitution personnalisée (Pilier 6.5) : le Badge Entrée reprend la phrase
  // d'ancrage ET le profil auto-déclaré de l'apprenant.
  const selfProfileKey = ((enrollment.completions.find((c) => c.blockIndex === 0 && c.itemKey === "profile")?.data ?? {}) as { profileKey?: string }).profileKey;
  const onboardingBlock = content.blocks.find((b) => b.type === "ONBOARDING");
  const selfProfileName = onboardingBlock?.type === "ONBOARDING" && selfProfileKey
    ? onboardingBlock.payload.profileChoices.find((c) => c.key === selfProfileKey)?.name ?? null : null;

  for (const idx of progress.completedBlockIndexes) {
    const block = content.blocks[idx]!;
    const type = badgeTypeForBlock(block.type);
    if (existingBadgeTypes.has(type)) continue;
    const message = badgeMessage(type, block.badge.label, enrollment.momentAncrage, selfProfileName);
    const badge = await prisma.badge.create({
      data: { enrollmentId, type, message, peerNotified: Boolean(enrollment.peerConsent && enrollment.peerEmail) },
    });
    // Mint a verifiable credential (OB 2.0 + signed OB 3.0). Non-fatal.
    try {
      const cred = await issueCredential({
        badgeId: badge.id, enrollmentId, recipientEmail: enrollment.user.email, recipientName: enrollment.user.name,
        courseSlug: enrollment.course.slug, badgeType: type, content, block,
      });
      // The FINAL certification (distinct from block badges) is also delivered
      // as a PDF: e-mailed with the verification link, downloadable in-app.
      if (type === "CERTIFICATE") await sendCertificateEmail(enrollment.user.email, enrollment.user.name, content.certificate.title, cred.id, enrollmentId);
    } catch (e) {
      console.error(`[credential] issuance failed for badge ${badge.id}:`, e instanceof Error ? e.message : e);
    }
    // Peer notification (Pilier 6.3) — by e-mail and, when a number is on file,
    // by mobile messaging (§7.1: e-mail alone underreaches African peers).
    // Sous réserve du consentement recueilli à la désignation (Pilier 6.3).
    if (enrollment.peerConsent && (enrollment.peerEmail || enrollment.peerPhone)) {
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

  // Anchor the journal trigger schedule on the COMPLETION of micro-session 4.3
  // (Section 3) — the J+2 → J+15 micro-entries are pushed and unlocked from
  // that date (« Amélioration » — déblocage progressif du Bloc 4).
  const cert = content.blocks.find((b) => b.type === "CERTIFICATION");
  let journalStartedAt = enrollment.journalStartedAt;
  const section3Done = cert && enrollment.completions.some((c) => c.blockIndex === cert.index && c.itemKey === projectSectionKey(2));
  if (cert && !journalStartedAt && section3Done) {
    journalStartedAt = new Date();
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { journalStartedAt } });
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
    /// Anchor of the Bloc 4 journal schedule (completion of 4.3) — lets the
    /// client display each micro-entry's unlock date.
    journalStartedAt: journalStartedAt ? journalStartedAt.toISOString() : null,
  };
}

/** E-mail the final certification as a PDF attachment (verification link in the
 *  body). Direct SMTP when configured (attachments); queued link-only otherwise.
 *  Best-effort — issuance never fails because of the mail. */
async function sendCertificateEmail(email: string, name: string, certTitle: string, credentialId: string, enrollmentId: string) {
  const verify = credentialUrl(credentialId);
  const body = [
    `Félicitations ${name} !`,
    ``,
    `Votre certification « ${certTitle} » est validée. Vous trouverez votre certificat en pièce jointe (PDF).`,
    ``,
    `Lien de vérification publique : ${verify}`,
    `Vous pouvez aussi la télécharger à tout moment depuis l'onglet Badges de la plateforme, et l'ajouter à votre profil LinkedIn.`,
  ].join("\n");
  try {
    if (smtpConfigured()) {
      const pdf = await certificatePdfOf(credentialId);
      await sendSmtpEmail(email, `Votre certification — ${certTitle}`, body, [{ filename: "certification.pdf", content: pdf, contentType: "application/pdf" }]);
    } else {
      await enqueueNotification({ enrollmentId, recipientKind: "LEARNER", recipient: email, channel: "EMAIL", subject: `Votre certification — ${certTitle}`, body, provider: "certificate" });
    }
  } catch (e) {
    console.error("[certificate] e-mail failed:", e instanceof Error ? e.message : e);
  }
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

// --- progressive Bloc 4 state + transcript (« Amélioration » lot) ------------

/** Everything the Project screen needs to render the PROGRESSIVE Bloc 4:
 *  per-section completion + stored text, the journal schedule (unlock dates),
 *  the auto-composed Section 4 chapter, and whether Section 5 is open. */
export async function projectState(enrollmentId: string) {
  const ctx = await loadContext(enrollmentId);
  const cert = ctx.content.blocks.find((b) => b.type === "CERTIFICATION");
  if (cert?.type !== "CERTIFICATION") throw new EngineError(409, "no_block", "Bloc 4 absent");
  const byKey = new Map(ctx.enrollment.completions.filter((c) => c.blockIndex === cert.index).map((c) => [c.itemKey, c] as const));
  const started = ctx.enrollment.journalStartedAt;

  const journal = cert.payload.journal.entries.map((e) => {
    const done = byKey.has(`J+${e.day}`);
    const unlocksAt = started ? journalUnlockAt(started, e.day) : null;
    return { day: e.day, done, unlocksAt: unlocksAt ? unlocksAt.toISOString() : null, unlocked: done || (unlocksAt != null && Date.now() >= unlocksAt.getTime()) };
  });
  const journalDone = journal.every((j) => j.done);
  const journalTexts = cert.payload.journal.entries
    .map((e) => ({ day: e.day, text: textOfData(byKey.get(`J+${e.day}`)?.data) }))
    .filter((e) => e.text);

  const sections = cert.payload.sections.map((sec, i) => {
    if (i === 3) return { key: "journal", title: sec.title, helpText: sec.helpText, auto: true as const, done: journalDone, text: composeJournalChapter(journalTexts), locked: false };
    const key = projectSectionKey(i);
    // Section 5 opens after sections 1–3 only : the journal NEVER locks the
    // final submission (K-HCBLM v2.2, Pilier 5) — missing entries are graded
    // down by rubric criterion S1 instead.
    const locked = i === 4 && [0, 1, 2].map(projectSectionKey).some((k) => !byKey.has(k));
    return { key, title: sec.title, helpText: sec.helpText, auto: false as const, done: byKey.has(key), text: textOfData(byKey.get(key)?.data), locked };
  });

  return { sections, journal, journalStartedAt: started ? started.toISOString() : null, finalSectionKey: PROJECT_FINAL_SECTION_KEY };
}

