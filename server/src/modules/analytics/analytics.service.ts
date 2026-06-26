/**
 * analytics.service.ts — reporting over existing runtime data (no new tables).
 *
 * Aggregations are computed on the fly with Prisma + the engine's progress
 * computation. (At scale these become materialized views / a warehouse.)
 */
import { prisma } from "../../db/prisma.js";
import { CourseContent, type CourseContent as CourseContentT } from "../../domain/content-model.js";
import { computeProgress, type CompletionRecord } from "../../domain/engine/progress.js";
import { forecastCompletion, type ForecastRow } from "../../domain/engine/forecast.js";
import { dropoutRisk } from "../../domain/engine/risk.js";
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
  const qs = block?.type === "COMPREHENSION" ? block.payload.diagnosticQuiz.questions : [];
  const wrong = qs
    .filter((q) => answers[q.id] != null && answers[q.id] !== q.correctKey)
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
