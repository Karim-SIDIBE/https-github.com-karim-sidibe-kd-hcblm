/**
 * api.ts — admin console API client. Talks to the same backend as the learner
 * PWA (analytics, users, enrolments, courses), with a Bearer access token.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "http://localhost:4000/api/v1";
const TOKEN_KEY = "kd_admin_token";
const USER_KEY = "kd_admin_user";

export type Principal = { id: string; name: string; email: string; role: string };
export const STAFF_ROLES = ["SUPER_ADMIN", "COURSE_ADMIN", "LEARNING_DESIGNER", "REVIEWER", "INSTRUCTOR", "EVALUATOR", "ENTERPRISE_CLIENT", "EMPLOYER"];
export const isStaff = (role?: string) => !!role && STAFF_ROLES.includes(role) && role !== "LEARNER";

export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: (): Principal | null => { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } },
  set: (token: string, user: Principal) => { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); },
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const t = auth.token();
  if (t) headers["authorization"] = `Bearer ${t}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 401) { auth.clear(); location.reload(); throw new ApiError(401, "unauthorized", "Session expirée"); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error || "error", json.message || "Erreur serveur");
  return (json.data ?? json) as T;
}

// --- auth ---
export async function login(email: string, password: string): Promise<{ accessToken: string; user: Principal }> {
  const res = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error || "error", j.message || "Identifiants invalides");
  return { accessToken: j.accessToken, user: j.user };
}

// --- types (mirror the backend responses) ---
export type CourseSummary = { id: string; slug: string; versions: { version: number; status: string; title: string; level: string }[] };
export type CourseReport = {
  enrollments: number; completionRate: number; activeLearners: number;
  forecast: { forecastPercent: number; currentPercent: number; certified: number };
  averageFinalQuiz: number | null; averageRubric: number | null;
  statusCounts?: Record<string, number>;
  blockFunnel: { index: number; type: string; completed: number }[];
  badgesIssued: { type: string; count: number }[]; credentialsIssued: number;
};
export type LearnerRow = {
  name: string; email: string; status: string; progressPercent: number;
  finalQuiz: number | null; rubric: number | null; active: boolean;
  lastActivity: string | null; startedAt: string | null; completedAt: string | null;
};

export type AuditRow = { id: string; actorId: string | null; action: string; targetType: string | null; targetId: string | null; ip: string | null; at: string };
export type ReEngagementResult = { processed?: number; sent?: number; byTier?: Record<string, number>; [k: string]: unknown };
export type Org = { id: string; name: string; slug: string; createdAt: string; _count?: { memberships: number; courses: number } };
export type Cohort = { id: string; name: string; courseId: string | null; createdAt: string; _count?: { memberships: number; threads: number } };
export type Session = { id: string; title: string; startsAt: string; durationMin: number; provider: string; status: string; courseId: string | null; _count?: { registrations: number } };
export type CredentialRow = {
  id: string; achievementType: string; badgeLabel: string; issuedAt: string;
  revoked: boolean; revocationReason: string | null;
  learner: { name: string; email: string }; courseTitle: string; verifyUrl: string;
};
export type RubricCriterion = { label: string; weightPoints: number };
export type EvalQueueItem = {
  enrollmentId: string; learner: { name: string; email: string }; courseTitle: string;
  submittedAt: string; revisionStatus: string; scoreTotal: number | null;
  evaluator: { id: string; name: string } | null;
  rubric: { criteria: RubricCriterion[]; threshold: number } | null;
};
export type ProjectDetail = {
  content: { sections?: Record<string, string> } | null;
  revisionStatus: string; scoreTotal: number | null; feedback: string | null;
  criteria: { label?: string; points: number }[] | null;
  evaluator: { id: string; name: string } | null; submittedAt: string;
};

// --- endpoints ---
export const api = {
  me: () => req<Principal>("GET", "/auth/me"),
  courses: () => req<CourseSummary[]>("GET", "/courses"),
  courseReport: (courseId: string) => req<CourseReport>("GET", `/analytics/courses/${courseId}`),
  courseLearners: (courseId: string) => req<LearnerRow[]>("GET", `/analytics/courses/${courseId}/learners`),
  createUser: (b: { name: string; email: string; password?: string; role?: string }) => req<{ id: string; email: string; name: string; role: string }>("POST", "/users", b),
  enroll: (userId: string, courseId: string) => req<{ id: string }>("POST", "/enrollments", { userId, courseId }),
  audit: (limit = 80) => req<AuditRow[]>("GET", `/audit?limit=${limit}`),
  runReEngagement: () => req<ReEngagementResult>("POST", "/jobs/re-engagement/run", {}),
  organizations: () => req<Org[]>("GET", "/organizations"),
  cohorts: () => req<Cohort[]>("GET", "/cohorts"),
  sessions: () => req<Session[]>("GET", "/sessions"),
  evaluations: () => req<EvalQueueItem[]>("GET", "/evaluations"),
  project: (enrollmentId: string) => req<ProjectDetail>("GET", `/enrollments/${enrollmentId}/project`),
  gradeProject: (enrollmentId: string, body: { criteria: { index: number; points: number }[]; notes?: string }) => req<unknown>("POST", `/enrollments/${enrollmentId}/evaluation`, body),
  assignEvaluator: (enrollmentId: string, evaluatorId: string) => req<unknown>("POST", `/enrollments/${enrollmentId}/project/assign`, { evaluatorId }),
  credentials: () => req<CredentialRow[]>("GET", "/credentials"),
  revokeCredential: (id: string, reason: string) => req<unknown>("POST", `/credentials/${id}/revoke`, { reason }),
  course: (id: string) => req<CourseFull>("GET", `/courses/${id}`),
};

export type CourseVersionFull = { version: number; status: string; title: string; level: string; domainLabel?: string; passThreshold?: number; publishedAt: string | null; updatedAt: string; content: { blocks?: { index: number; type: string; title: string; payload?: Record<string, unknown> }[] } };
export type CourseFull = { id: string; slug: string; versions: CourseVersionFull[] };

/** Title of the latest published (or newest) version of a course. */
export function courseTitle(c: CourseSummary): string {
  const pub = c.versions.find((v) => v.status === "PUBLISHED") ?? c.versions[0];
  return pub?.title ?? c.slug;
}
