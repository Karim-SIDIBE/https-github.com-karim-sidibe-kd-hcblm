/**
 * analytics.service.ts — reporting over existing runtime data (no new tables).
 *
 * Aggregations are computed on the fly with Prisma + the engine's progress
 * computation. (At scale these become materialized views / a warehouse.)
 */
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { CourseContent, type CourseContent as CourseContentT } from "../../domain/content-model.js";
import { blockRequirements, computeProgress, type CompletionRecord } from "../../domain/engine/progress.js";
import { courseFunnel, questionDifficulty, timeByItem, videoCompletion } from "../../domain/engine/insights.js";
import { XAPI_EXT } from "../../domain/engine/xapi.js";
import { forecastCompletion, type ForecastRow } from "../../domain/engine/forecast.js";
import { dropoutRisk } from "../../domain/engine/risk.js";
import { shuffleQuestionOptions } from "../../domain/engine/shuffle.js";
import { aggregateCompetencies } from "../../domain/engine/competency.js";
import type { SubAreaScore } from "../../domain/engine/progress.js";
import { credentialUrl } from "../../lib/credentials/openbadge.js";
import type { Sheet, Cell } from "../../lib/export/xlsx.js";

/** Optional reporting window (filters by enrolment start). */
export type DateRange = { since?: Date; until?: Date };
function startedAtFilter(range?: DateRange) {
  if (!range || (!range.since && !range.until)) return {};
  return { startedAt: { ...(range.since ? { gte: range.since } : {}), ...(range.until ? { lte: range.until } : {}) } };
}
const daysBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 86_400_000);

export class AnalyticsError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

const ACTIVE_WINDOW_DAYS = 14;
const records = (cs: { blockIndex: number; itemKey: string; scorePct: number | null }[]): CompletionRecord[] =>
  cs.map((c) => ({ blockIndex: c.blockIndex, itemKey: c.itemKey, scorePct: c.scorePct }));
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const isActive = (d: Date | null, now: Date) => Boolean(d && now.getTime() - d.getTime() <= ACTIVE_WINDOW_DAYS * 86_400_000);

// --- learner transcript (official record) -----------------------------------

export async function transcript(enrollmentId: string) {
  const e = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { user: true, courseVersion: { include: { course: true } }, completions: true, badges: { orderBy: { issuedAt: "asc" } }, credentials: true },
  });
  if (!e) throw new AnalyticsError(404, "not_found", "Inscription introuvable");
  const content = CourseContent.parse(e.courseVersion.content);
  const progress = computeProgress(content, records(e.completions), Boolean(e.momentAncrage));

  const score = (blockIndex: number, key: string) => e.completions.find((c) => c.blockIndex === blockIndex && c.itemKey === key)?.scorePct ?? null;

  // Relevé de résultats (« Amélioration » lot) — one row per scored quiz or
  // graded activity (score %, or correct/total for the non-graded checks),
  // labelled from the content, in completion order.
  const rowLabels = new Map<string, { label: string; scored: boolean }>();
  for (const b of content.blocks) {
    if (b.type === "COMPREHENSION") {
      rowLabels.set(`${b.index}:diagnostic`, { label: b.payload.diagnosticQuiz.title || "Quiz diagnostique", scored: true });
      if (b.payload.caseStudy) rowLabels.set(`${b.index}:case`, { label: b.payload.caseStudy.subtitle || b.payload.caseStudy.title, scored: false });
    } else if (b.type === "PRACTICE") {
      if (b.payload.interBlockQuiz) rowLabels.set(`${b.index}:interblock`, { label: b.payload.interBlockQuiz.title || "Quiz interbloc", scored: false });
      if (b.payload.guidedScenarios.length) rowLabels.set(`${b.index}:scenarios`, { label: b.payload.guidedScenariosTitle || "Mises en situation guidées", scored: false });
    } else if (b.type === "ANCHORING") {
      rowLabels.set(`${b.index}:final`, { label: b.payload.finalQuiz.title || "Quiz final", scored: true });
      if (b.payload.transversalCase) rowLabels.set(`${b.index}:case`, { label: b.payload.transversalCase.subtitle || b.payload.transversalCase.title, scored: false });
    } else if (b.type === "CERTIFICATION") {
      rowLabels.set(`${b.index}:rubric`, { label: "Évaluation finale du projet (grille /100)", scored: true });
    }
  }
  const rows = e.completions
    .map((c) => {
      const meta = rowLabels.get(`${c.blockIndex}:${c.itemKey}`);
      const d = (c.data ?? {}) as { correct?: number; total?: number };
      const correct = typeof d.correct === "number" ? d.correct : null;
      const total = typeof d.total === "number" ? d.total : null;
      if (!meta || (c.scorePct == null && correct == null)) return null;
      return { key: `${c.blockIndex}:${c.itemKey}`, label: meta.label, scorePct: c.scorePct, correct, total, scored: meta.scored && c.scorePct != null, at: c.completedAt.toISOString() };
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => a.at.localeCompare(b.at));
  const attendance = await prisma.sessionRegistration.findMany({
    where: { userId: e.userId, session: { courseId: e.courseId } }, include: { session: { select: { title: true, startsAt: true } } },
  });

  return {
    learner: { id: e.user.id, name: e.user.name, email: e.user.email },
    course: { slug: e.courseVersion.course.slug, title: e.courseVersion.title, level: e.courseVersion.level },
    status: e.status,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    lastActivity: e.lastSeenAt,
    progress: {
      blocksTotal: content.blocks.length,
      blocksCompleted: progress.completedBlockIndexes.length,
      percent: Math.round((progress.completedBlockIndexes.length / content.blocks.length) * 100),
      blocks: progress.blocks.map((b) => ({ index: b.index, type: b.type, state: b.state })),
    },
    scores: { diagnostic: score(1, "diagnostic"), finalQuiz: score(3, "final"), rubric: score(4, "rubric") },
    rows,
    badges: e.badges.map((b) => ({ type: b.type, issuedAt: b.issuedAt })),
    credentials: e.credentials.map((c) => ({ id: c.id, type: c.achievementType, revoked: Boolean(c.revokedAt), url: credentialUrl(c.id), verifyUrl: `${credentialUrl(c.id)}/verify` })),
    liveSessions: attendance.map((a) => ({ title: a.session.title, startsAt: a.session.startsAt, attended: a.attended, minutes: a.attendanceMinutes })),
  };
}

// --- per-learner rows for a course (exportable) -----------------------------

export async function courseLearners(courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AnalyticsError(404, "not_found", "Parcours introuvable");
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId }, include: { user: true, courseVersion: true, completions: true },
  });
  const now = new Date();
  return enrollments.map((e) => {
    const content = CourseContent.parse(e.courseVersion.content);
    const progress = computeProgress(content, records(e.completions), Boolean(e.momentAncrage));
    const score = (bi: number, k: string) => e.completions.find((c) => c.blockIndex === bi && c.itemKey === k)?.scorePct ?? null;
    return {
      id: e.user.id, enrollmentId: e.id, name: e.user.name, email: e.user.email, status: e.status,
      progressPercent: Math.round((progress.completedBlockIndexes.length / content.blocks.length) * 100),
      finalQuiz: score(3, "final"), rubric: score(4, "rubric"),
      active: isActive(e.lastSeenAt, now), lastActivity: e.lastSeenAt, startedAt: e.startedAt, completedAt: e.completedAt,
    };
  });
}

// --- dropout-risk ranking (predictive analytics) ----------------------------

/** Score every non-finished learner of a course for dropout risk, ranked. */
export async function atRiskLearners(courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AnalyticsError(404, "no_course", "Parcours introuvable");
  const now = new Date();
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    include: { user: { select: { id: true, name: true, email: true } }, courseVersion: true, completions: true, _count: { select: { reEngagements: true } } },
  });
  return enrollments
    .map((e) => {
      const content = CourseContent.parse(e.courseVersion.content);
      const progress = computeProgress(content, records(e.completions), Boolean(e.momentAncrage));
      const score = (bi: number, k: string) => e.completions.find((c) => c.blockIndex === bi && c.itemKey === k)?.scorePct ?? null;
      const progressPercent = Math.round((progress.completedBlockIndexes.length / content.blocks.length) * 100);
      const risk = dropoutRisk({
        certified: e.status === "CERTIFIED",
        completed: progress.courseCompleted,
        daysSinceActivity: daysBetween(e.lastSeenAt ?? e.startedAt, now),
        daysSinceStart: daysBetween(e.startedAt, now),
        progressPercent,
        pamCaptured: Boolean(e.momentAncrage),
        diagnosticScore: score(1, "diagnostic"),
        failedFinal: progress.blocks.some((b) => b.index === 3 && b.failedThreshold != null),
        nudgesSent: e._count.reEngagements,
      });
      return {
        id: e.user.id, enrollmentId: e.id, name: e.user.name, email: e.user.email,
        progressPercent, lastActivity: e.lastSeenAt, status: e.status,
        riskScore: risk.score, riskLevel: risk.level, factors: risk.factors.slice(0, 3).map((f) => f.label),
      };
    })
    .filter((s) => s.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore);
}

// --- cohort competency map (diagnostic strengths/weaknesses) ----------------

/** Average diagnostic sub-area scores across a course's learners, weakest first. */
export async function courseCompetencies(courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AnalyticsError(404, "no_course", "Parcours introuvable");
  const rows = await prisma.itemCompletion.findMany({
    where: { enrollment: { courseId }, itemType: "DIAGNOSTIC_QUIZ" },
    select: { data: true },
  });
  const perLearner = rows
    .map((r) => (r.data as { subAreaScores?: SubAreaScore[] } | null)?.subAreaScores ?? [])
    .filter((s) => s.length > 0);
  return { learnersAssessed: perLearner.length, competencies: aggregateCompetencies(perLearner) };
}

// --- per-learner diagnostic profile (strengths / weaknesses) ----------------

/** A single learner's diagnostic competency profile, for admin + learner views. */
export async function learnerDiagnostic(enrollmentId: string) {
  const row = await prisma.itemCompletion.findFirst({
    where: { enrollmentId, itemType: "DIAGNOSTIC_QUIZ" },
    select: { scorePct: true, data: true, completedAt: true },
  });
  if (!row) return { taken: false as const };
  const data = row.data as { profile?: string; subAreaScores?: SubAreaScore[]; priorities?: { subArea: string; pct: number }[] } | null;
  const subAreaScores = (data?.subAreaScores ?? []).map((s) => ({ subArea: s.subArea, pct: s.pct }));
  const byStrong = [...subAreaScores].sort((a, b) => b.pct - a.pct);
  return {
    taken: true as const,
    scorePct: row.scorePct,
    profile: data?.profile ?? null,
    completedAt: row.completedAt,
    subAreaScores: [...subAreaScores].sort((a, b) => a.pct - b.pct), // weakest first
    strengths: byStrong.slice(0, 2),
    weaknesses: data?.priorities ?? byStrong.slice(-2).reverse(),
  };
}

/**
 * Adaptive remediation (Pilier 3, contract-safe): the diagnostic questions the
 * learner got WRONG, with the correct answer + feedback — for an optional review.
 * Additive only; touches neither the block structure nor the pass thresholds.
 */
export async function diagnosticReview(enrollmentId: string) {
  const completion = await prisma.itemCompletion.findFirst({
    where: { enrollmentId, itemType: "DIAGNOSTIC_QUIZ" }, select: { data: true },
  });
  const answers = (completion?.data as { answers?: Record<string, string> } | null)?.answers;
  if (!answers) return { taken: false as const, wrong: [] };
  const enr = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, select: { courseVersion: { select: { content: true } } } });
  if (!enr) return { taken: false as const, wrong: [] };
  const content = CourseContent.parse(enr.courseVersion.content);
  const block = content.blocks.find((b) => b.type === "COMPREHENSION");
  // The learner answered the PER-LEARNER lettering (options shuffled + re-keyed
  // at materialisation) — rebuild the same view before comparing/stored keys.
  const raw = block?.type === "COMPREHENSION" ? block.payload.diagnosticQuiz.questions : [];
  const qs = raw.map((q) => shuffleQuestionOptions(q as never, `${enrollmentId}:diagnostic`)) as typeof raw;
  const wrong = qs
    // Profiling questions have no wrong answer — they never need revision.
    .filter((q) => !q.profiling && answers[q.id] != null && answers[q.id] !== q.correctKey)
    .map((q) => ({ id: q.id, subArea: q.subArea ?? null, prompt: q.scenarioText, options: q.options, correctKey: q.correctKey, yourKey: answers[q.id]!, feedback: q.feedbackText }));
  return { taken: true as const, total: qs.length, wrong };
}

// --- course report (aggregates + funnel) ------------------------------------

export async function courseReport(courseId: string, range?: DateRange) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AnalyticsError(404, "not_found", "Parcours introuvable");
  const enrollments = await prisma.enrollment.findMany({ where: { courseId, ...startedAtFilter(range) }, include: { courseVersion: true, completions: true } });
  const now = new Date();

  const statusCounts: Record<string, number> = {};
  const finalScores: number[] = [];
  const rubricScores: number[] = [];
  let active = 0;
  let blocksTotal = 0;
  const funnel: number[] = [];
  let content: CourseContentT | null = null;
  const forecastRows: ForecastRow[] = [];

  for (const e of enrollments) {
    content = CourseContent.parse(e.courseVersion.content);
    blocksTotal = content.blocks.length;
    const progress = computeProgress(content, records(e.completions), Boolean(e.momentAncrage));
    statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1;
    if (isActive(e.lastSeenAt, now)) active++;
    const f = e.completions.find((c) => c.blockIndex === 3 && c.itemKey === "final")?.scorePct;
    if (f != null) finalScores.push(f);
    const r = e.completions.find((c) => c.blockIndex === 4 && c.itemKey === "rubric")?.scorePct;
    if (r != null) rubricScores.push(r);
    for (const idx of progress.completedBlockIndexes) funnel[idx] = (funnel[idx] ?? 0) + 1;
    forecastRows.push({
      blocksCompleted: progress.completedBlockIndexes.length,
      blocksTotal: content.blocks.length,
      daysSinceStart: daysBetween(e.startedAt, now),
      certified: e.status === "CERTIFIED",
      terminated: e.status === "WITHDRAWN",
    });
  }

  const total = enrollments.length;
  const certified = statusCounts["CERTIFIED"] ?? 0;
  const [badges, credentials, tutorSessions] = await Promise.all([
    prisma.badge.groupBy({ by: ["type"], where: { enrollment: { courseId } }, _count: true }),
    prisma.credential.count({ where: { enrollment: { courseId } } }),
    prisma.tutorSession.count({ where: { enrollment: { courseId } } }),
  ]);
  const reg = await prisma.sessionRegistration.findMany({ where: { session: { courseId } }, select: { attended: true } });

  return {
    course: { slug: course.slug },
    enrollments: total,
    statusCounts,
    completionRate: total ? Math.round((certified / total) * 100) : 0,
    // Forecast: % of enrolees expected to reach Block 4 completion (§7.3).
    forecast: forecastCompletion(forecastRows),
    range: { since: range?.since ?? null, until: range?.until ?? null },
    activeLearners: active,
    averageFinalQuiz: avg(finalScores),
    averageRubric: avg(rubricScores),
    blockFunnel: content ? content.blocks.map((b) => ({ index: b.index, type: b.type, completed: funnel[b.index] ?? 0 })) : [],
    blocksTotal,
    badgesIssued: badges.map((b) => ({ type: b.type, count: b._count })),
    credentialsIssued: credentials,
    tutorSessions,
    sessionAttendance: { registrations: reg.length, attended: reg.filter((r) => r.attended).length },
  };
}

// --- platform overview ------------------------------------------------------

export async function overview(range?: DateRange) {
  const now = new Date();
  const since = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 86_400_000);
  const rangeWhere = startedAtFilter(range);
  const [usersByRole, publishedCourses, enrollments, certified, activeLearners, credentialsIssued, credentialsRevoked, upcomingSessions] =
    await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.courseVersion.count({ where: { status: "PUBLISHED" } }),
      prisma.enrollment.count({ where: rangeWhere }),
      prisma.enrollment.count({ where: { status: "CERTIFIED", ...rangeWhere } }),
      prisma.enrollment.count({ where: { lastSeenAt: { gte: since }, ...rangeWhere } }),
      prisma.credential.count(),
      prisma.credential.count({ where: { revokedAt: { not: null } } }),
      prisma.liveSession.count({ where: { startsAt: { gte: now }, status: { in: ["SCHEDULED", "LIVE"] } } }),
    ]);
  return {
    usersByRole: usersByRole.map((u) => ({ role: u.role, count: u._count })),
    publishedCourses, enrollments, certified,
    completionRate: enrollments ? Math.round((certified / enrollments) * 100) : 0,
    activeLearners, credentialsIssued, credentialsRevoked, upcomingSessions,
    range: { since: range?.since ?? null, until: range?.until ?? null },
  };
}

// --- raw PAM export (§6.1) --------------------------------------------------

/**
 * Raw Moment d'Ancrage (PAM) export for a course — for authorised employer /
 * institutional review and AI-feedback integration. Staff-gated at the route.
 */
export async function pamExport(courseId: string, range?: DateRange) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new AnalyticsError(404, "not_found", "Parcours introuvable");
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId, momentAncrage: { not: null }, ...startedAtFilter(range) },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { startedAt: "asc" },
  });
  return enrollments.map((e) => ({
    learnerId: e.user.id, name: e.user.name, email: e.user.email,
    momentAncrage: e.momentAncrage, startedAt: e.startedAt,
  }));
}

// --- cohort report ----------------------------------------------------------

export async function cohortReport(cohortId: string) {
  const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, include: { memberships: { include: { user: true } } } });
  if (!cohort) throw new AnalyticsError(404, "not_found", "Cohorte introuvable");
  const now = new Date();

  const members = await Promise.all(cohort.memberships.map(async (m) => {
    const enrollment = cohort.courseId
      ? await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: m.userId, courseId: cohort.courseId } }, include: { courseVersion: true, completions: true } })
      : null;
    let progressPercent = 0;
    let status = "NOT_ENROLLED";
    if (enrollment) {
      const content = CourseContent.parse(enrollment.courseVersion.content);
      const p = computeProgress(content, records(enrollment.completions), Boolean(enrollment.momentAncrage));
      progressPercent = Math.round((p.completedBlockIndexes.length / content.blocks.length) * 100);
      status = enrollment.status;
    }
    return { name: m.user.name, email: m.user.email, status, progressPercent, active: isActive(enrollment?.lastSeenAt ?? null, now), lastActivity: enrollment?.lastSeenAt ?? null };
  }));

  return {
    cohort: { id: cohort.id, name: cohort.name, courseId: cohort.courseId },
    members: members.length,
    completed: members.filter((m) => m.status === "CERTIFIED").length,
    averageProgress: avg(members.map((m) => m.progressPercent)),
    rows: members,
  };
}

const RISK_FR: Record<string, string> = { high: "Élevé", medium: "Moyen", low: "Faible" };
const fdate = (d: Date | string | null | undefined): string => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "");

/** Assemble a multi-sheet workbook (Synthèse, Entonnoir, Apprenants, À risque,
 *  Compétences) for a course — over the FULL dataset (not the browser view). */
export async function courseWorkbook(courseId: string): Promise<Sheet[]> {
  const [report, learners, risk, comp] = await Promise.all([
    courseReport(courseId), courseLearners(courseId), atRiskLearners(courseId), courseCompetencies(courseId),
  ]);
  const certified = report.statusCounts?.CERTIFIED ?? report.forecast.certified ?? 0;

  const synthese: Cell[][] = [
    ["Indicateur", "Valeur"],
    ["Apprenants inscrits", report.enrollments],
    ["Actifs (7 jours)", report.activeLearners],
    ["Taux de complétion (%)", report.completionRate],
    ["Prévision de certification (%)", report.forecast.forecastPercent],
    ["Apprenants certifiés", certified],
    ["Certificats délivrés", report.credentialsIssued],
    ["Moyenne quiz final (%)", report.averageFinalQuiz ?? ""],
    ["Moyenne grille B4 (%)", report.averageRubric ?? ""],
  ];
  const entonnoir: Cell[][] = [
    ["Bloc", "Type", "Complétés", "% des inscrits"],
    ...report.blockFunnel.map((b) => [b.index, b.type, b.completed, report.enrollments ? Math.round((b.completed / report.enrollments) * 100) : 0] as Cell[]),
  ];
  const apprenants: Cell[][] = [
    ["Nom", "E-mail", "Statut", "Progression (%)", "Quiz final (%)", "Projet B4 (%)", "Actif", "Dernière activité", "Démarré le", "Certifié le"],
    ...learners.map((l) => [l.name, l.email, l.status, l.progressPercent, l.finalQuiz ?? "", l.rubric ?? "", l.active ? "Oui" : "Non", fdate(l.lastActivity), fdate(l.startedAt), fdate(l.completedAt)] as Cell[]),
  ];
  const aRisque: Cell[][] = [
    ["Nom", "E-mail", "Progression (%)", "Statut", "Score de risque", "Niveau", "Facteurs"],
    ...risk.map((r) => [r.name, r.email, r.progressPercent, r.status, r.riskScore, RISK_FR[r.riskLevel] ?? r.riskLevel, r.factors.join(" · ")] as Cell[]),
  ];
  const competences: Cell[][] = [
    ["Compétence", "Score moyen (%)", "Apprenants évalués"],
    ...comp.competencies.map((c) => [c.subArea, c.avgPct, c.learners] as Cell[]),
  ];

  return [
    { name: "Synthèse", rows: synthese },
    { name: "Entonnoir", rows: entonnoir },
    { name: "Apprenants", rows: apprenants },
    { name: "À risque", rows: aRisque },
    { name: "Compétences", rows: competences },
  ];
}

// --- pedagogical insights (local xAPI mini-LRS) ------------------------------

/** A comparable slice of a course's enrollments: an inscription window or a cohort. */
export type SegmentFilter =
  | { kind: "period"; since: Date; until: Date }
  | { kind: "cohort"; cohortId: string };

async function segmentEnrollmentIds(courseId: string, segment: SegmentFilter): Promise<string[]> {
  const where: Prisma.EnrollmentWhereInput = { courseId };
  if (segment.kind === "period") {
    where.startedAt = { gte: segment.since, lte: segment.until };
  } else {
    where.user = { cohortMemberships: { some: { cohortId: segment.cohortId } } };
  }
  const rows = await prisma.enrollment.findMany({ where, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * The four steering indicators computed from granular xAPI traces + completions:
 * question difficulty, real time-on-task per item, video completion, and the
 * course funnel (drop-off along the canonical item sequence). SQL aggregates
 * here; shaping is pure (domain/engine/insights).
 */
export async function courseInsights(courseId: string, segment?: SegmentFilter) {
  const version = await prisma.courseVersion.findFirst({
    where: { courseId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
  if (!version) throw new AnalyticsError(404, "no_published_version", "Aucune version publiée pour ce parcours");
  const content = CourseContent.parse(version.content);

  // Segment restriction (comparison feature): NULL id list = whole course.
  const ids = segment ? await segmentEnrollmentIds(courseId, segment) : null;
  const idsSql = ids === null ? Prisma.sql`` : Prisma.sql` AND e.id IN (${ids.length ? Prisma.join(ids) : Prisma.sql`NULL`})`;

  const [enrolled, answeredRows, timeRows, videoRows, completionRows] = await Promise.all([
    ids === null ? prisma.enrollment.count({ where: { courseId } }) : Promise.resolve(ids.length),
    prisma.$queryRaw<{ objectId: string; total: number; correct: number }[]>`
      SELECT s."objectId" AS "objectId", COUNT(*)::int AS total,
             (COUNT(*) FILTER (WHERE s.statement->'result'->>'success' = 'true'))::int AS correct
      FROM "XapiStatement" s JOIN "Enrollment" e ON e.id = s."enrollmentId"
      WHERE e."courseId" = ${courseId} AND s.verb = ${"answered"}
        AND s."objectId" LIKE '%/questions/%'${idsSql}
      GROUP BY 1`,
    prisma.$queryRaw<{ objectId: string; enrollmentId: string; seconds: number }[]>`
      SELECT s."objectId" AS "objectId", s."enrollmentId" AS "enrollmentId",
             SUM((s.statement->'result'->'extensions'->>${XAPI_EXT.timeOnTaskSeconds})::numeric)::float AS seconds
      FROM "XapiStatement" s JOIN "Enrollment" e ON e.id = s."enrollmentId"
      WHERE e."courseId" = ${courseId}
        AND (s.statement->'result'->'extensions'->>${XAPI_EXT.timeOnTaskSeconds}) IS NOT NULL${idsSql}
      GROUP BY 1, 2`,
    prisma.$queryRaw<{ objectId: string; enrollmentId: string; maxProgress: number }[]>`
      SELECT s."objectId" AS "objectId", s."enrollmentId" AS "enrollmentId",
             MAX((s.statement->'result'->'extensions'->>${XAPI_EXT.videoProgress})::numeric)::float AS "maxProgress"
      FROM "XapiStatement" s JOIN "Enrollment" e ON e.id = s."enrollmentId"
      WHERE e."courseId" = ${courseId} AND s.verb = ${"progressed"}
        AND (s.statement->'result'->'extensions'->>${XAPI_EXT.videoProgress}) IS NOT NULL${idsSql}
      GROUP BY 1, 2`,
    prisma.$queryRaw<{ blockIndex: number; itemKey: string; completions: number }[]>`
      SELECT ic."blockIndex" AS "blockIndex", ic."itemKey" AS "itemKey",
             COUNT(DISTINCT ic."enrollmentId")::int AS completions
      FROM "ItemCompletion" ic JOIN "Enrollment" e ON e.id = ic."enrollmentId"
      WHERE e."courseId" = ${courseId}${idsSql}
      GROUP BY 1, 2`,
  ]);

  const difficulty = questionDifficulty(answeredRows);

  // Resolve question labels: fixed course questions first, then the bank.
  const labelById = new Map<string, string>();
  for (const b of content.blocks) {
    // Scored quizzes carry `scenarioText`; the (non-scored) trigger quiz `text`.
    const quizzes: { questions?: { id: string; scenarioText?: string; text?: string }[] }[] = [];
    if (b.type === "ONBOARDING") quizzes.push(b.payload.triggerQuiz);
    if (b.type === "COMPREHENSION") quizzes.push(b.payload.diagnosticQuiz);
    if (b.type === "PRACTICE" && b.payload.interBlockQuiz) quizzes.push(b.payload.interBlockQuiz);
    if (b.type === "ANCHORING") quizzes.push(b.payload.finalQuiz);
    for (const q of quizzes) for (const question of q.questions ?? []) {
      const label = question.scenarioText ?? question.text;
      if (label) labelById.set(question.id, label);
    }
  }
  const unknown = difficulty.map((d) => d.questionId).filter((id) => !labelById.has(id));
  if (unknown.length > 0) {
    const bank = await prisma.bankQuestion.findMany({ where: { id: { in: unknown } }, select: { id: true, question: true } });
    for (const b of bank) {
      const text = (b.question as { scenarioText?: string } | null)?.scenarioText;
      if (text) labelById.set(b.id, text);
    }
  }
  const questions = difficulty.slice(0, 25).map((d) => ({ ...d, label: labelById.get(d.questionId) ?? d.questionId }));

  const required = content.blocks.flatMap((b) =>
    blockRequirements(b).map((r) => ({ blockIndex: b.index, key: r.key, label: r.label })),
  );

  return {
    enrolled,
    questions,
    time: timeByItem(timeRows),
    videos: videoCompletion(videoRows),
    funnel: courseFunnel(required, completionRows, enrolled),
  };
}

// --- trace explorer (free-form aggregation, "Series API" style) --------------

export type ExploreGroupBy = "verb" | "activity" | "item" | "block" | "learner" | "day";
export type ExploreFilters = {
  verb?: string; blockIndex?: number; itemKey?: string; since?: Date; until?: Date;
};

/**
 * One-dimension aggregation over the course's statements: pick a grouping, get
 * per-bucket volume, distinct learners, success rate (scored traces only) and
 * total time-on-task. The heavy lifting stays in SQL on the indexed columns.
 */
export async function exploreStatements(courseId: string, groupBy: ExploreGroupBy, f: ExploreFilters = {}) {
  const dim = {
    verb: Prisma.sql`s.verb`,
    activity: Prisma.sql`s."objectId"`,
    item: Prisma.sql`substring(s."objectId" from 'blocks/[0-9]+/items/([^/]+)')`,
    block: Prisma.sql`substring(s."objectId" from 'blocks/([0-9]+)')`,
    learner: Prisma.sql`e."userId"`,
    day: Prisma.sql`to_char(s."storedAt", 'YYYY-MM-DD')`,
  }[groupBy];
  const cond: Prisma.Sql[] = [Prisma.sql`e."courseId" = ${courseId}`];
  if (f.verb) cond.push(Prisma.sql`s.verb = ${f.verb}`);
  if (f.blockIndex != null) cond.push(Prisma.sql`s."objectId" LIKE ${"%/blocks/" + f.blockIndex + "/%"} OR s."objectId" LIKE ${"%/blocks/" + f.blockIndex}`);
  if (f.itemKey) cond.push(Prisma.sql`s."objectId" LIKE ${"%/items/" + f.itemKey} OR s."objectId" LIKE ${"%/items/" + f.itemKey + "/%"}`);
  if (f.since) cond.push(Prisma.sql`s."storedAt" >= ${f.since}`);
  if (f.until) cond.push(Prisma.sql`s."storedAt" <= ${f.until}`);
  const where = Prisma.join(cond.map((c) => Prisma.sql`(${c})`), " AND ");

  const rows = await prisma.$queryRaw<{
    key: string | null; statements: number; learners: number;
    scored: number; successes: number; seconds: number | null;
  }[]>`
    SELECT ${dim} AS key,
           COUNT(*)::int AS statements,
           COUNT(DISTINCT s."enrollmentId")::int AS learners,
           (COUNT(*) FILTER (WHERE s.statement->'result'->>'success' IS NOT NULL))::int AS scored,
           (COUNT(*) FILTER (WHERE s.statement->'result'->>'success' = 'true'))::int AS successes,
           SUM((s.statement->'result'->'extensions'->>${XAPI_EXT.timeOnTaskSeconds})::numeric)::float AS seconds
    FROM "XapiStatement" s JOIN "Enrollment" e ON e.id = s."enrollmentId"
    WHERE ${where}
    GROUP BY 1 ORDER BY 2 DESC LIMIT 100`;

  // Learner buckets get human labels; other dimensions are self-describing.
  const labels = new Map<string, string>();
  if (groupBy === "learner") {
    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.key).filter((k): k is string => k != null) } },
      select: { id: true, name: true, email: true },
    });
    for (const u of users) labels.set(u.id, `${u.name} (${u.email})`);
  }
  return rows
    .filter((r) => r.key != null)
    .map((r) => ({
      key: r.key!,
      label: labels.get(r.key!) ?? r.key!,
      statements: r.statements,
      learners: r.learners,
      successPct: r.scored > 0 ? Math.round((r.successes / r.scored) * 100) : null,
      minutes: r.seconds != null ? Math.round(r.seconds / 60) : null,
    }));
}

// --- segment comparison (periods or cohorts) ---------------------------------

/** Compress one segment's insights into comparable headline numbers. */
export function summarizeInsights(ins: Awaited<ReturnType<typeof courseInsights>>) {
  const qTotals = ins.questions.reduce((a, q) => a + q.total, 0);
  const qCorrect = ins.questions.reduce((a, q) => a + q.correct, 0);
  const funnelEnd = ins.funnel[ins.funnel.length - 1];
  const vids = ins.videos.filter((v) => v.learners > 0);
  return {
    enrolled: ins.enrolled,
    avgQuestionPct: qTotals > 0 ? Math.round((qCorrect / qTotals) * 100) : null,
    funnelEndPct: funnelEnd?.pctOfEnrolled ?? 0,
    avgVideoFinishedPct: vids.length ? Math.round(vids.reduce((a, v) => a + v.finishedPct, 0) / vids.length) : null,
  };
}

export async function compareInsights(courseId: string, a: SegmentFilter, b: SegmentFilter) {
  const [insA, insB] = await Promise.all([courseInsights(courseId, a), courseInsights(courseId, b)]);
  return {
    a: { insights: insA, summary: summarizeInsights(insA) },
    b: { insights: insB, summary: summarizeInsights(insB) },
  };
}

/** Minimal CSV serializer for report rows. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

// --- Cibles K-HCBLM v2.2 (chapitre 7) ----------------------------------------

/** Indicateurs de complétion et d'engagement du modèle, mesurés contre leurs
 *  cibles officielles (K-HCBLM v2.2, ch. 7). Sans courseId, porte sur le
 *  parcours le plus inscrit. Le taux de soumission des micro-exercices compte
 *  les complétions des micro-sessions PORTEUSES d'un exercice (Blocs 1-3) —
 *  une micro-session à exercice ne se complète qu'à la soumission. */
export async function khcblmTargets(courseId?: string) {
  const course = courseId
    ? await prisma.course.findUnique({ where: { id: courseId } })
    : (await prisma.course.findFirst({ orderBy: { enrollments: { _count: "desc" } } }));
  if (!course) throw new AnalyticsError(404, "not_found", "Aucun parcours");

  const where = { courseId: course.id };
  const total = await prisma.enrollment.count({ where });
  const badgeCounts = await prisma.badge.groupBy({
    by: ["type"], _count: { _all: true }, where: { enrollment: where },
  });
  const badges = Object.fromEntries(badgeCounts.map((b) => [b.type, b._count._all])) as Record<string, number>;
  const pairs = await prisma.enrollment.count({ where: { ...where, peerEmail: { not: null } } });

  // Micro-sessions à exercice (Blocs 1-3) du contenu publié.
  const published = await prisma.courseVersion.findFirst({
    where: { courseId: course.id, status: "PUBLISHED" }, orderBy: { version: "desc" },
  });
  const parsed = published ? CourseContent.safeParse(published.content) : null;
  const exerciseKeys: string[] = [];
  if (parsed?.success) {
    for (const b of parsed.data.blocks) {
      if (!("payload" in b) || !("microSessions" in b.payload)) continue;
      for (const ms of b.payload.microSessions ?? []) if (ms.exercise) exerciseKeys.push(ms.id);
    }
  }
  const exercisesSubmitted = exerciseKeys.length === 0 ? 0 : await prisma.itemCompletion.count({
    where: { enrollment: where, itemType: "MICRO_SESSION", itemKey: { in: exerciseKeys } },
  });
  const exercisesExpected = exerciseKeys.length * total;

  const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 100));
  const metric = (key: string, label: string, valuePct: number | null, targetPct: number) => ({
    key, label, valuePct, targetPct, met: valuePct == null ? null : valuePct >= targetPct,
  });

  return {
    course: { id: course.id, slug: course.slug },
    enrollments: total,
    metrics: [
      metric("bloc0", "Taux de complétion Bloc 0", pct(badges.ENTRY ?? 0, total), 95),
      metric("bloc1", "Taux de complétion Bloc 1", pct(badges.COMPREHENSION ?? 0, total), 85),
      metric("bloc2", "Taux de complétion Bloc 2", pct(badges.PRACTICE ?? 0, total), 75),
      metric("bloc3", "Taux de complétion Bloc 3", pct(badges.ANCHORING ?? 0, total), 70),
      metric("certification", "Taux de certification finale (Bloc 4)", pct(badges.CERTIFICATE ?? 0, total), 60),
      metric("exercices", "Taux de soumission des micro-exercices", pct(exercisesSubmitted, exercisesExpected), 80),
      metric("pair", "Taux de désignation d'un pair de progression", pct(pairs, total), 50),
    ],
  };
}

/**
 * Indicateurs de surveillance de la suggestion automatisée (socle §8.10) :
 *   1. taux de blocage PAR CRITÈRE (> 20 % → le descripteur demande une
 *      inférence au lieu d'un fait : réviser le descripteur, pas le modèle) ;
 *   2. concordance IA / humain PAR CRITÈRE (> 90 % → l'évaluateur a cessé
 *      d'évaluer et valide la suggestion) ;
 *   3. identité des preuves humaine et IA (100 % → copie systématique : la
 *      preuve humaine ne démontre plus la lecture du dossier).
 */
export async function aiComplianceIndicators(courseId?: string) {
  const assessments = await prisma.aiAssessment.findMany({
    where: { kind: "RUBRIC_SUGGESTION", ...(courseId ? { enrollment: { courseId } } : {}) },
    orderBy: { createdAt: "asc" },
  });

  type SuggestedCrit = {
    label: string; suggested: number;
    verification?: { ok: boolean; issues: string[] };
  };
  type Agg = { requests: number; evidenceFailed: number; graded: number; concordant: number; copyTotal: number; copyIdentical: number };
  const byCriterion = new Map<string, Agg>();
  const agg = (label: string): Agg => {
    let a = byCriterion.get(label);
    if (!a) { a = { requests: 0, evidenceFailed: 0, graded: 0, concordant: 0, copyTotal: 0, copyIdentical: 0 }; byCriterion.set(label, a); }
    return a;
  };

  for (const assessment of assessments) {
    const crits = (assessment.criteria ?? []) as unknown as SuggestedCrit[];
    if (!Array.isArray(crits)) continue;
    const finals = (assessment.finalScores ?? null) as { label: string; points: number }[] | null;
    const copies = (assessment.copyFlags ?? null) as boolean[] | null;
    crits.forEach((c, i) => {
      if (!c?.label) return;
      const a = agg(c.label);
      a.requests += 1;
      if (c.verification && !c.verification.ok) a.evidenceFailed += 1;
      if (finals?.[i]) { a.graded += 1; if (finals[i]!.points === c.suggested) a.concordant += 1; }
      if (copies) { a.copyTotal += 1; if (copies[i]) a.copyIdentical += 1; }
    });
  }

  const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 100));
  const criteria = [...byCriterion.entries()].map(([label, a]) => {
    const blockRatePct = pct(a.evidenceFailed, a.requests);
    const concordancePct = pct(a.concordant, a.graded);
    const evidenceIdentityPct = pct(a.copyIdentical, a.copyTotal);
    return {
      label,
      requests: a.requests,
      blockRatePct, blockAlert: blockRatePct != null && blockRatePct > 20,
      concordancePct, concordanceAlert: concordancePct != null && concordancePct > 90,
      evidenceIdentityPct, identityAlert: evidenceIdentityPct === 100,
    };
  });

  return {
    totals: {
      suggestions: assessments.length,
      blocked: assessments.filter((a) => a.blocked).length,
      displayed: assessments.filter((a) => !a.blocked).length,
      linkedToFinal: assessments.filter((a) => a.finalScores != null).length,
    },
    criteria,
  };
}
