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
export type LoginResult =
  | { accessToken: string; user: Principal }
  | { twoFactorRequired: true; challenge: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error || "error", j.message || "Identifiants invalides");
  if (j.twoFactorRequired) return { twoFactorRequired: true, challenge: j.challenge };
  return { accessToken: j.accessToken, user: j.user };
}

/** Complete a 2FA login with a TOTP or backup code. */
export async function verify2fa(challenge: string, code: string): Promise<{ accessToken: string; user: Principal }> {
  const res = await fetch(`${BASE}/auth/2fa/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challenge, code }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error || "error", j.message || "Code invalide");
  return { accessToken: j.accessToken, user: j.user };
}

// 2FA self-management (authenticated)
export const twofa = {
  status: () => req<{ enabled: boolean }>("GET", "/auth/2fa/status"),
  setup: () => req<{ secret: string; otpauthUrl: string }>("POST", "/auth/2fa/setup", {}),
  enable: (code: string) => req<{ enabled: true; backupCodes: string[] }>("POST", "/auth/2fa/enable", { code }),
  disable: (code: string) => req<{ disabled: true }>("POST", "/auth/2fa/disable", { code }),
};

// Active sessions / devices.
export type SessionInfo = { familyId: string; device: string; ip: string | null; lastUsedAt: string; createdAt: string; current: boolean };
export const sessions = {
  mine: () => req<SessionInfo[]>("GET", "/auth/sessions"),
  revoke: (familyId: string) => req<{ revoked: number }>("POST", "/auth/sessions/revoke", { familyId }),
  revokeAll: () => req<{ revoked: number }>("POST", "/auth/sessions/revoke-all", {}),
};

// RGPD data-rights (admin): export, erasure, and a user's sessions.
export const rgpd = {
  exportUser: (userId: string) => req<unknown>("GET", `/users/${userId}/export`),
  erase: (userId: string, mode: "anonymize" | "delete") => req<{ scheduled: true; mode: string; userId: string; purgeAt: string }>("POST", `/users/${userId}/erase`, { mode }),
  restore: (userId: string) => req<{ restored: true; userId: string }>("POST", `/users/${userId}/restore`, {}),
  userSessions: (userId: string) => req<SessionInfo[]>("GET", `/users/${userId}/sessions`),
  revokeUserSessions: (userId: string) => req<{ revoked: number }>("POST", `/users/${userId}/sessions/revoke-all`, {}),
};
export type RetentionResult = { erasuresExecuted: number; anonymized: number; deleted: number; tokensPurged: number; auditPurged: number; codesPurged: number };

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
  id: string; enrollmentId: string; name: string; email: string; status: string; progressPercent: number;
  finalQuiz: number | null; rubric: number | null; active: boolean;
  lastActivity: string | null; startedAt: string | null; completedAt: string | null;
};
export type AtRiskLearner = { id: string; enrollmentId: string; name: string; email: string; progressPercent: number; lastActivity: string | null; status: string; riskScore: number; riskLevel: "low" | "medium" | "high"; factors: string[] };
export type CourseCompetencies = { learnersAssessed: number; competencies: { subArea: string; avgPct: number; learners: number }[] };
type SubScore = { subArea: string; pct: number };
export type LearnerDiagnostic = { taken: boolean; scorePct?: number | null; profile?: string | null; completedAt?: string; subAreaScores?: SubScore[]; strengths?: SubScore[]; weaknesses?: SubScore[] };
export type InviteResult = { tempPassword: string; delivered: boolean; channels: { provider: string; ok: boolean }[] };
export type UserRow = { id: string; name: string; email: string; role: string; verified: boolean; disabled: boolean; locked: boolean; anonymized: boolean; deletionDaysLeft: number | null; enrollments: number; createdAt: string };
export type MediaAsset = { id: string; kind: string; filename: string | null; mime: string; sizeBytes: number | null; durationSec: number | null; status: string; error?: string | null; renditions: string[]; createdAt: string };
export type MediaPlayback = { assetId: string; status: string; durationSec: number | null; renditions: { label: string; kind: string; url: string; bitrateKbps?: number | null }[] };
export type Seats = { seats: number; used: number; available: number };
export type ImportDocResult = { content: any; blockNotes: Record<number, string>; aiGenerated: boolean; provider: string; paragraphs: number };
export type OrgMember = { id: string; orgRole: "OWNER" | "ADMIN" | "MEMBER"; createdAt: string; user: { id: string; name: string; email: string; role: string; disabledAt: string | null } };

export type AuditRow = { id: string; actorId: string | null; action: string; targetType: string | null; targetId: string | null; ip: string | null; at: string };
export type ReEngagementResult = { processed?: number; sent?: number; byTier?: Record<string, number>; [k: string]: unknown };
export type Org = { id: string; name: string; slug: string; seats: number; createdAt: string; _count?: { memberships: number; courses: number } };
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
  atRisk: (courseId: string) => req<AtRiskLearner[]>("GET", `/analytics/courses/${courseId}/at-risk`),
  competencies: (courseId: string) => req<CourseCompetencies>("GET", `/analytics/courses/${courseId}/competencies`),
  learnerDiagnostic: (enrollmentId: string) => req<LearnerDiagnostic>("GET", `/analytics/enrollments/${enrollmentId}/diagnostic`),
  createUser: (b: { name: string; email: string; password?: string; role?: string }) => req<{ id: string; email: string; name: string; role: string }>("POST", "/users", b),
  enroll: (userId: string, courseId: string) => req<{ id: string }>("POST", "/enrollments", { userId, courseId }),
  resetEnrollment: (enrollmentId: string, mode: "full" | "version") => req<{ mode: string; version: number }>("POST", `/enrollments/${enrollmentId}/reset`, { mode }),
  nudgeLearner: (enrollmentId: string) => req<{ sent: boolean; stage: string; email: string }>("POST", `/enrollments/${enrollmentId}/nudge`, {}),
  invite: (userId: string, password?: string) => req<InviteResult>("POST", `/users/${userId}/invite`, password ? { password } : {}),
  deleteUser: (userId: string) => req<{ id: string; email: string }>("DELETE", `/users/${userId}`),
  users: (q = "") => req<UserRow[]>("GET", `/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  media: () => req<MediaAsset[]>("GET", "/media"),
  async mediaPlayback(id: string): Promise<MediaPlayback> {
    const data = await req<any>("GET", `/media/${id}/playback`);
    // Absolutise the API-relative + signed URLs so a native <video> can stream them.
    if (Array.isArray(data?.renditions)) data.renditions = data.renditions.map((r: any) => ({ ...r, url: r.url ? new URL(r.url, BASE).href : r.url }));
    return data as MediaPlayback;
  },
  async uploadMedia(file: File): Promise<MediaAsset> {
    const fd = new FormData();
    fd.append("file", file);
    const t = auth.token();
    const res = await fetch(`${BASE}/media`, { method: "POST", headers: t ? { authorization: `Bearer ${t}` } : {}, body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, j.error || "error", j.message || "Téléversement échoué");
    return j.data as MediaAsset;
  },
  async importCourseDoc(file: File): Promise<ImportDocResult> {
    const fd = new FormData();
    fd.append("file", file);
    const t = auth.token();
    const res = await fetch(`${BASE}/courses/import-doc`, { method: "POST", headers: t ? { authorization: `Bearer ${t}` } : {}, body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, j.error || "error", j.message || "Import du document échoué");
    return j.data as ImportDocResult;
  },
  // organizations & licensing (platform provisioning)
  createOrg: (name: string, slug: string) => req<Org>("POST", "/organizations", { name, slug }),
  orgSeats: (orgId: string) => req<Seats>("GET", `/organizations/${orgId}/seats`),
  setOrgSeats: (orgId: string, seats: number) => req<Seats>("PATCH", `/organizations/${orgId}/seats`, { seats }),
  orgMembers: (orgId: string) => req<OrgMember[]>("GET", `/organizations/${orgId}/members`),
  addOrgMember: (orgId: string, userId: string, orgRole: "OWNER" | "ADMIN" | "MEMBER") => req<unknown>("POST", `/organizations/${orgId}/members`, { userId, orgRole }),
  audit: (limit = 80) => req<AuditRow[]>("GET", `/audit?limit=${limit}`),
  runReEngagement: () => req<ReEngagementResult>("POST", "/jobs/re-engagement/run", {}),
  runRetention: () => req<RetentionResult>("POST", "/jobs/retention/run", {}),
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
  validateCourse: (content: unknown) => req<ValidateResult>("POST", "/courses/validate", { content }),
  createCourse: (slug: string, content: unknown) => req<{ id: string }>("POST", "/courses", { slug, content }),
  newVersion: (courseId: string, content: unknown) => req<{ id: string; version: number; status: string }>("POST", `/courses/${courseId}/versions`, { content }),
  submitReview: (versionId: string) => req<unknown>("POST", `/versions/${versionId}/submit-review`, {}),
  reviewVersion: (versionId: string, decision: "approve" | "request_changes", notes?: string) => req<{ status: string }>("POST", `/versions/${versionId}/review`, { decision, notes }),
  publishVersion: (versionId: string) => req<unknown>("POST", `/versions/${versionId}/publish`, {}),
  issuer: () => req<Issuer>("GET", "/credentials/issuer"),
  webhooks: () => req<Webhook[]>("GET", "/webhooks"),
};

export type Issuer = { name: string; url: string; id: string };
export type Webhook = { id: string; url: string; events?: string[]; organizationId?: string | null };

export type ValidationIssue = { level: "error" | "warning"; rule: string; path: string; message: string };
export type ValidateResult = { shape: { ok: boolean; issues?: ValidationIssue[] }; policy?: { ok: boolean; issues: ValidationIssue[] } };

export type CourseVersionFull = { id: string; version: number; status: string; title: string; level: string; domainLabel?: string; passThreshold?: number; publishedAt: string | null; updatedAt: string; content: { blocks?: { index: number; type: string; title: string; payload?: Record<string, unknown> }[] } };
export type CourseFull = { id: string; slug: string; versions: CourseVersionFull[] };

/** Title of the latest published (or newest) version of a course. */
export function courseTitle(c: CourseSummary): string {
  const pub = c.versions.find((v) => v.status === "PUBLISHED") ?? c.versions[0];
  return pub?.title ?? c.slug;
}
