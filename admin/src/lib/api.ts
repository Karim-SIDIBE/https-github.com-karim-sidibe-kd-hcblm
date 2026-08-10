/**
 * api.ts — admin console API client. Talks to the same backend as the learner
 * PWA (analytics, users, enrolments, courses), with a Bearer access token.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "http://localhost:4000/api/v1";
const TOKEN_KEY = "kd_admin_token";
const REFRESH_KEY = "kd_admin_refresh";
const USER_KEY = "kd_admin_user";

/** An ACTIVE admin never gets logged out mid-work: on access-token expiry the
 *  session is silently renewed (rotating refresh token) and the request
 *  retried. Only an admin idle beyond this window is actually logged out. */
const IDLE_LOGOUT_MS = 30 * 60_000;
let lastActivity = Date.now();
if (typeof window !== "undefined") {
  for (const ev of ["pointerdown", "keydown"]) {
    window.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true });
  }
}

export type Principal = { id: string; name: string; email: string; role: string };
export const STAFF_ROLES = ["SUPER_ADMIN", "COURSE_ADMIN", "LEARNING_DESIGNER", "REVIEWER", "INSTRUCTOR", "EVALUATOR", "ENTERPRISE_CLIENT", "EMPLOYER"];
export const isStaff = (role?: string) => !!role && STAFF_ROLES.includes(role) && role !== "LEARNER";

export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY),
  refreshToken: () => localStorage.getItem(REFRESH_KEY),
  user: (): Principal | null => { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } },
  set: (token: string, user: Principal, refreshToken?: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); localStorage.removeItem(USER_KEY); },
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

// Single-flight silent renewal: many parallel 401s share one refresh call.
let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  const rt = auth.refreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: rt }) });
    if (!res.ok) return false;
    const j = await res.json().catch(() => ({}));
    if (!j.accessToken) return false;
    localStorage.setItem(TOKEN_KEY, j.accessToken);
    if (j.refreshToken) localStorage.setItem(REFRESH_KEY, j.refreshToken); // rotation
    return true;
  } catch { return false; }
}

/** Paged-list envelope returned by the server list endpoints. */
export type Paged<T> = { data: T[]; total: number; page: number; pageSize: number };

/** Like req() but returns the FULL response envelope (data + total + …). */
async function reqPaged<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  return req<T>("GET", `${path}${qs.toString() ? `?${qs}` : ""}`, undefined, false, true);
}

async function req<T>(method: string, path: string, body?: unknown, retried = false, raw = false): Promise<T> {
  const headers: Record<string, string> = {};
  const t = auth.token();
  if (t) headers["authorization"] = `Bearer ${t}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 401) {
    // Active session → silent renewal + one retry; idle or failed renewal →
    // real logout (the security timeout the console is expected to have).
    const idle = Date.now() - lastActivity > IDLE_LOGOUT_MS;
    if (!retried && !idle && auth.refreshToken()) {
      const ok = await (refreshing ??= tryRefresh().finally(() => { refreshing = null; }));
      if (ok) return req<T>(method, path, body, true, raw);
    }
    auth.clear(); location.reload(); throw new ApiError(401, "unauthorized", "Session expirée");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error || "error", json.message || "Erreur serveur");
  return (raw ? json : json.data ?? json) as T;
}

// --- auth ---
export type LoginResult =
  | { accessToken: string; refreshToken?: string; user: Principal }
  | { twoFactorRequired: true; challenge: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error || "error", j.message || "Identifiants invalides");
  if (j.twoFactorRequired) return { twoFactorRequired: true, challenge: j.challenge };
  return { accessToken: j.accessToken, refreshToken: j.refreshToken, user: j.user };
}

/** Complete a 2FA login with a TOTP or backup code. */
export async function verify2fa(challenge: string, code: string): Promise<{ accessToken: string; refreshToken?: string; user: Principal }> {
  const res = await fetch(`${BASE}/auth/2fa/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challenge, code }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error || "error", j.message || "Code invalide");
  return { accessToken: j.accessToken, refreshToken: j.refreshToken, user: j.user };
}

/** Voluntary logout: revoke the server-side session (best-effort), clear local. */
export async function logoutEverywhere(): Promise<void> {
  const rt = auth.refreshToken();
  if (rt) {
    try { await fetch(`${BASE}/auth/logout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: rt }) }); } catch { /* best-effort */ }
  }
  auth.clear();
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
export type ExploreBucket = { key: string; label: string; statements: number; learners: number; successPct: number | null; minutes: number | null };
export type InsightsSummary = { enrolled: number; avgQuestionPct: number | null; funnelEndPct: number; avgVideoFinishedPct: number | null };
export type InsightsCompare = { a: { insights: CourseInsights; summary: InsightsSummary }; b: { insights: CourseInsights; summary: InsightsSummary } };
export type CourseInsights = {
  enrolled: number;
  questions: { questionId: string; label: string; blockIndex: number | null; itemKey: string | null; total: number; correct: number; pctCorrect: number }[];
  time: { blockIndex: number; itemKey: string; learners: number; avgSeconds: number }[];
  videos: { blockIndex: number | null; itemKey: string | null; learners: number; avgPct: number; finishedPct: number }[];
  funnel: { blockIndex: number; itemKey: string; label: string; completions: number; pctOfEnrolled: number }[];
};
type SubScore = { subArea: string; pct: number };
export type LearnerDiagnostic = { taken: boolean; scorePct?: number | null; profile?: string | null; completedAt?: string; subAreaScores?: SubScore[]; strengths?: SubScore[]; weaknesses?: SubScore[] };
export type InviteResult = { tempPassword: string; delivered: boolean; channels: { provider: string; ok: boolean }[] };
export type UserRow = { id: string; name: string; email: string; role: string; verified: boolean; disabled: boolean; locked: boolean; anonymized: boolean; deletionDaysLeft: number | null; enrollments: number; createdAt: string };
export type MediaAsset = { id: string; kind: string; filename: string | null; mime: string; sizeBytes: number | null; durationSec: number | null; status: string; error?: string | null; folderId: string | null; renditions: string[]; createdAt: string };
export type MediaFolder = { id: string; name: string; assetCount: number; createdAt: string };
export type MediaPlayback = { assetId: string; status: string; durationSec: number | null; renditions: { label: string; kind: string; url: string; bitrateKbps?: number | null }[] };
export type Seats = { seats: number; used: number; available: number };
export type ReportSchedule = { id: string; courseId: string; recipients: string[]; frequency: "WEEKLY" | "MONTHLY"; format: string; active: boolean; lastSentAt: string | null; createdAt: string };
export type BankQuestion = { id: string; question: any; subArea: string; level: string; status: string; origin: string; note: string; sourceCourseId: string | null; createdAt: string };
export type ImportDocResult = { content: any; blockNotes: Record<number, string>; aiGenerated: boolean; provider: string; paragraphs: number };
export type OrgMember = { id: string; orgRole: "OWNER" | "ADMIN" | "MEMBER"; createdAt: string; user: { id: string; name: string; email: string; role: string; disabledAt: string | null } };

export type AuditRow = { id: string; actorId: string | null; action: string; targetType: string | null; targetId: string | null; ip: string | null; at: string; meta?: Record<string, unknown> | null; actor?: { name: string; email: string } | null };
export type ReEngagementResult = { scanned: number; created: { enrollmentId: string; stage: string; channel: string; body: string; aiGenerated: boolean }[] };
export type RelanceRow = { id: string; stage: string; channel: string; sentAt: string; body: string; enrollmentId: string; learner: { id: string; name: string; email: string } };
export type ForumThreadRow = { id: string; title: string; locked: boolean; pinned: boolean; createdAt: string; updatedAt: string; author: { id: string; name: string } | null; _count?: { posts: number } };
export type ForumPostRow = { id: string; body: string; createdAt: string; editedAt: string | null; deletedAt: string | null; author: { id: string; name: string } | null };
export type ThreadDetail = ForumThreadRow & { posts: ForumPostRow[] };
export type IntegrationsStatus = {
  saml: { enabled: boolean; issuer: string; jitProvision: boolean; entryPointConfigured: boolean; certConfigured: boolean; metadataUrl: string; loginUrl: string; acsUrl: string };
  oidc: { enabled: boolean; issuer: string | null; audience: string | null; jitProvision: boolean };
  lti: { configUrl: string; jwksUrl: string; oidcInitiationUrl: string; targetLinkUri: string; platforms: { id: string; name: string | null; issuer: string; clientId: string; deploymentId: string | null; createdAt: string }[] };
  scim: { baseUrl: string; organizations: { id: string; name: string; slug: string; tokenProvisioned: boolean }[] };
};
export type Org = { id: string; name: string; slug: string; seats: number; createdAt: string; _count?: { memberships: number; courses: number } };
export type Cohort = { id: string; name: string; courseId: string | null; createdAt: string; _count?: { memberships: number; threads: number } };
export type Session = { id: string; title: string; startsAt: string; durationMin: number; provider: string; status: string; courseId: string | null; joinUrl?: string | null; _count?: { registrations: number } };
export type SessionRegistrant = { userId: string; attended: boolean; attendanceMinutes: number | null; registeredAt: string; user: { id: string; name: string; email: string } };
export type CohortDetail = { id: string; name: string; courseId: string | null; courseSlug: string | null; createdAt: string; threads: number; members: { id: string; name: string; email: string; role: string; since: string }[] };
export type RubricSuggestion = { perCriterion: { label: string; weightPoints: number; suggested: number; comment: string }[]; suggestedTotal: number; summary: string; aiGenerated: boolean; provider: string };
export type CredentialRow = {
  id: string; achievementType: string; badgeLabel: string; issuedAt: string;
  revoked: boolean; revocationReason: string | null;
  learner: { name: string; email: string }; courseTitle: string; verifyUrl: string;
};
export type SavedViewRow = { id: string; name: string; config: Record<string, unknown>; updatedAt: string };
export type JobRunRow = { id: string; name: string; trigger: string; actorId: string | null; startedAt: string; finishedAt: string | null; ok: boolean | null; result: Record<string, unknown> | null; error: string | null };
export type JobInfo = {
  key: string; label: string; description: string; cadence: string;
  lastRun: { id: string; trigger: string; startedAt: string; finishedAt: string | null; ok: boolean | null; durationMs: number | null; result: Record<string, unknown> | null; error: string | null } | null;
};
export type WebhookDelivery = { id: string; event: string; status: string; attempts: number; responseCode: number | null; error: string | null; createdAt: string; sentAt: string | null };
export type ImportReport = {
  total: number; created: number; existing: number; enrolled: number; invited: number;
  errors: { line: number; email: string; error: string }[];
  credentials: { email: string; password: string }[];
};
export type RubricBand = { band: number; scoreRange: [number, number]; descriptor: string };
export type RubricCriterion = {
  label: string; weightPoints: number;
  /** Grille à bandes (socle v1.1) : minimum de non-compensation, origine,
   *  « où chercher la preuve » et les 4 descripteurs. Absents = grille plate. */
  minPoints?: number; origin?: "annexe" | "socle"; whereToLook?: string; bands?: RubricBand[];
};
export type EvalQueueItem = {
  enrollmentId: string; learner: { name: string; email: string }; courseTitle: string;
  submittedAt: string; revisionStatus: string; scoreTotal: number | null;
  evaluator: { id: string; name: string } | null;
  rubric: { criteria: RubricCriterion[]; threshold: number } | null;
  /** Part calculée par la plateforme du critère S1 (socle §3) : décompte des
   *  entrées du journal, dates de saisie et détection du rattrapage groupé. */
  journal: { expected: number; completed: number; entries: { day: number; completedAt: string | null }[]; groupedCatchup: boolean } | null;
};
/** Cibles K-HCBLM v2.2 (ch. 7) — mesures vs cibles officielles du modèle. */
export type KhcblmTargets = {
  course: { id: string; slug: string };
  enrollments: number;
  metrics: { key: string; label: string; valuePct: number | null; targetPct: number; met: boolean | null }[];
};
/** Habilitation d'évaluateur (socle §9.2) — 12 mois par parcours. */
export type Accreditation = {
  id: string;
  evaluator: { id: string; name: string; email: string; role: string };
  course: { id: string; slug: string };
  grantedAt: string; expiresAt: string; revokedAt: string | null;
  grantedBy: { id: string; name: string } | null;
  notes: string | null;
  status: "active" | "expired" | "revoked";
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
  courseReport: (courseId: string, range: { since?: string; until?: string } = {}) => {
    const qs = new URLSearchParams();
    if (range.since) qs.set("since", range.since);
    if (range.until) qs.set("until", range.until);
    return req<CourseReport>("GET", `/analytics/courses/${courseId}${qs.toString() ? `?${qs}` : ""}`);
  },
  courseLearners: (courseId: string) => req<LearnerRow[]>("GET", `/analytics/courses/${courseId}/learners`),
  atRisk: (courseId: string) => req<AtRiskLearner[]>("GET", `/analytics/courses/${courseId}/at-risk`),
  khcblmTargets: (courseId: string) => req<KhcblmTargets>("GET", `/analytics/khcblm-targets?courseId=${encodeURIComponent(courseId)}`),
  // UI texts — super-admin overrides of the learner-app interface copy.
  uiTexts: (app = "web") => req<{ fr: Record<string, string>; en: Record<string, string> }>("GET", `/ui-texts?app=${app}`),
  setUiText: (locale: "fr" | "en", key: string, value: string, app = "web") => req<unknown>("PUT", "/ui-texts", { app, locale, key, value }),
  resetUiText: (locale: "fr" | "en", key: string, app = "web") => req<{ reverted: boolean }>("DELETE", "/ui-texts", { app, locale, key }),
  // Question bank (reusable questions inserted into course quizzes).
  bankQuestions: (subArea?: string, status?: string) => {
    const q = new URLSearchParams();
    if (subArea) q.set("subArea", subArea);
    if (status) q.set("status", status);
    const qs = q.toString();
    return req<BankQuestion[]>("GET", `/bank/questions${qs ? `?${qs}` : ""}`);
  },
  approveBankQuestion: (id: string) => req<BankQuestion>("POST", `/bank/questions/${id}/approve`, {}),
  importBankFromCourse: (courseId: string) => req<{ total: number; created: number; updated: number }>("POST", `/bank/import/${courseId}`, {}),
  bankSubAreas: () => req<string[]>("GET", "/bank/subareas"),
  addBankQuestion: (b: { question: unknown; subArea?: string; level?: string }) => req<BankQuestion>("POST", "/bank/questions", b),
  deleteBankQuestion: (id: string) => req<{ id: string }>("DELETE", `/bank/questions/${id}`),
  bankRandom: (subArea: string | undefined, count: number) => req<any[]>("GET", `/bank/questions/random?count=${count}${subArea ? `&subArea=${encodeURIComponent(subArea)}` : ""}`),
  reportSchedules: (courseId: string) => req<ReportSchedule[]>("GET", `/reports/schedules?courseId=${courseId}`),
  createReportSchedule: (b: { courseId: string; recipients: string[]; frequency: "WEEKLY" | "MONTHLY"; format?: "xlsx" | "csv" }) =>
    req<ReportSchedule>("POST", "/reports/schedules", b),
  deleteReportSchedule: (id: string) => req<{ id: string }>("DELETE", `/reports/schedules/${id}`),
  async exportCourseXlsx(courseId: string): Promise<Blob> {
    const t = auth.token();
    const res = await fetch(`${BASE}/analytics/courses/${courseId}/export.xlsx`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    if (!res.ok) throw new ApiError(res.status, "error", "Export Excel échoué");
    return res.blob();
  },
  competencies: (courseId: string) => req<CourseCompetencies>("GET", `/analytics/courses/${courseId}/competencies`),
  insights: (courseId: string) => req<CourseInsights>("GET", `/analytics/courses/${courseId}/insights`),
  explore: (courseId: string, groupBy: string, filters: Record<string, string>) => {
    const p = new URLSearchParams({ groupBy, ...filters });
    return req<ExploreBucket[]>("GET", `/analytics/courses/${courseId}/explore?${p.toString()}`);
  },
  compareInsights: (courseId: string, params: Record<string, string>) => {
    const p = new URLSearchParams(params);
    return req<InsightsCompare>("GET", `/analytics/courses/${courseId}/insights/compare?${p.toString()}`);
  },
  async exportStatements(courseId: string, format: "csv" | "ndjson"): Promise<Blob> {
    const t = auth.token();
    const res = await fetch(`${BASE}/lrs/statements?courseId=${encodeURIComponent(courseId)}&limit=1000&format=${format}`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    if (!res.ok) throw new ApiError(res.status, "error", "Export xAPI échoué");
    return res.blob();
  },
  lrsArchives: () => req<{ name: string; sizeBytes: number; createdAt: string }[]>("GET", "/lrs/archives"),
  async downloadArchive(name: string): Promise<Blob> {
    const t = auth.token();
    const res = await fetch(`${BASE}/lrs/archives/${encodeURIComponent(name)}`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    if (!res.ok) throw new ApiError(res.status, "error", "Téléchargement d'archive échoué");
    return res.blob();
  },
  learnerDiagnostic: (enrollmentId: string) => req<LearnerDiagnostic>("GET", `/analytics/enrollments/${enrollmentId}/diagnostic`),
  createUser: (b: { name: string; email: string; password?: string; role?: string }) => req<{ id: string; email: string; name: string; role: string }>("POST", "/users", b),
  enroll: (userId: string, courseId: string) => req<{ id: string }>("POST", "/enrollments", { userId, courseId }),
  resetEnrollment: (enrollmentId: string, mode: "full" | "version") => req<{ mode: string; version: number }>("POST", `/enrollments/${enrollmentId}/reset`, { mode }),
  nudgeLearner: (enrollmentId: string) => req<{ sent: boolean; stage: string; email: string }>("POST", `/enrollments/${enrollmentId}/nudge`, {}),
  enrollmentPeer: async (enrollmentId: string) => {
    const d = await req<any>("GET", `/enrollments/${enrollmentId}`);
    return { name: d?.peer?.name ?? null, notified: d?.peer?.notified ?? false };
  },
  setPeer: (enrollmentId: string, name: string, email: string) => req<unknown>("POST", `/enrollments/${enrollmentId}/peer`, { name, email }),
  invite: (userId: string, password?: string) => req<InviteResult>("POST", `/users/${userId}/invite`, password ? { password } : {}),
  deleteUser: (userId: string) => req<{ id: string; email: string }>("DELETE", `/users/${userId}`),
  users: (q = "") => req<UserRow[]>("GET", `/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  media: () => req<MediaAsset[]>("GET", "/media"),
  mediaFolders: () => req<MediaFolder[]>("GET", "/media/folders"),
  createMediaFolder: (name: string) => req<MediaFolder>("POST", "/media/folders", { name }),
  renameMediaFolder: (id: string, name: string) => req<MediaFolder>("PATCH", `/media/folders/${id}`, { name }),
  deleteMediaFolder: (id: string) => req<{ id: string }>("DELETE", `/media/folders/${id}`),
  updateMedia: (id: string, patch: { filename?: string; folderId?: string | null }) => req<MediaAsset>("PATCH", `/media/${id}`, patch),
  deleteMedia: (id: string) => req<{ id: string; removedObjects: number }>("DELETE", `/media/${id}`),
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
  createSession: (b: { title: string; description?: string; provider: string; startsAt: string; durationMin: number; capacity?: number; courseId?: string; joinUrl?: string }) =>
    req<Session>("POST", "/sessions", b),
  sessionRoster: (id: string) => req<SessionRegistrant[]>("GET", `/sessions/${id}/registrations`),
  registerToSession: (id: string, userId: string) => req<unknown>("POST", `/sessions/${id}/register`, { userId }),
  markAttendance: (id: string, entries: { userId: string; minutes?: number }[]) =>
    req<{ marked: number; xapiEmitted?: number }>("POST", `/sessions/${id}/attendance`, { entries }),
  cancelSession: (id: string) => req<Session>("POST", `/sessions/${id}/cancel`, {}),
  createCohort: (name: string, courseId?: string) => req<Cohort>("POST", "/cohorts", { name, ...(courseId ? { courseId } : {}) }),
  cohortDetail: (id: string) => req<CohortDetail>("GET", `/cohorts/${id}`),
  addCohortMember: (id: string, userId: string) => req<unknown>("POST", `/cohorts/${id}/members`, { userId }),
  removeCohortMember: (id: string, userId: string) => req<unknown>("DELETE", `/cohorts/${id}/members/${userId}`),
  unrevokeCredential: (id: string) => req<{ id: string; revoked: boolean }>("POST", `/credentials/${id}/unrevoke`, {}),
  async credentialFile(id: string, kind: "pdf" | "vc"): Promise<Blob> {
    const t = auth.token();
    const path = kind === "pdf" ? `/credentials/${id}/certificate.pdf` : `/credentials/${id}/vc`;
    const res = await fetch(`${BASE}${path}`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    if (!res.ok) throw new ApiError(res.status, "error", "Téléchargement échoué");
    return res.blob();
  },
  rubricSuggestion: (enrollmentId: string) => req<RubricSuggestion>("POST", `/enrollments/${enrollmentId}/rubric-suggestion`, {}),
  updateBankQuestion: (id: string, b: { question?: unknown; subArea?: string; level?: string }) => req<BankQuestion>("PATCH", `/bank/questions/${id}`, b),
  // --- paged lists (M2: real server-side pagination/sort/search) ---
  usersPaged: (p: { q?: string; page?: number; pageSize?: number; sort?: string }) => reqPaged<Paged<UserRow>>("/users", p),
  auditPaged: (p: { q?: string; action?: string; page?: number; pageSize?: number }) => reqPaged<Paged<AuditRow>>("/audit", p),
  mediaPaged: (p: { q?: string; folder?: string; page?: number; pageSize?: number }) => reqPaged<Paged<MediaAsset>>("/media", p),
  credentialsPaged: (p: { q?: string; status?: string; page?: number; pageSize?: number }) => reqPaged<Paged<CredentialRow> & { valid: number; revoked: number }>("/credentials", p),
  learnersPaged: (courseId: string, p: { q?: string; status?: string; page?: number; pageSize?: number; sort?: string }) => reqPaged<Paged<LearnerRow>>(`/analytics/courses/${courseId}/learners`, p),
  updateUser: (id: string, b: { name?: string; email?: string; role?: string; disabled?: boolean; password?: string }) => req<{ id: string; name: string; email: string; role: string; disabled: boolean }>("PATCH", `/users/${id}`, b),
  // --- saved views (per-user, per-screen, stored server-side) ---
  views: (screen: string) => req<SavedViewRow[]>("GET", `/views?screen=${encodeURIComponent(screen)}`),
  saveView: (screen: string, name: string, config: Record<string, unknown>) => req<SavedViewRow>("PUT", "/views", { screen, name, config }),
  deleteView: (id: string) => req<{ id: string }>("DELETE", `/views/${id}`),
  // --- jobs monitor (M3) ---
  jobs: () => req<JobInfo[]>("GET", "/jobs"),
  jobRuns: (p: { name?: string; page?: number; pageSize?: number }) => reqPaged<Paged<JobRunRow>>("/jobs/runs", p),
  runJobPath: (path: string, body: Record<string, unknown> = {}) => req<Record<string, unknown>>("POST", path, body),
  // --- webhooks (M3) ---
  createWebhook: (b: { url: string; events: string[]; secret?: string }) => req<Webhook>("POST", "/webhooks", b),
  updateWebhook: (id: string, b: { url?: string; events?: string[]; active?: boolean }) => req<Webhook>("PATCH", `/webhooks/${id}`, b),
  deleteWebhook: (id: string) => req<{ deleted: boolean }>("DELETE", `/webhooks/${id}`),
  webhookDeliveries: (id: string) => req<WebhookDelivery[]>("GET", `/webhooks/${id}/deliveries`),
  testWebhook: (id: string) => req<{ ok: boolean; responseCode: number | null; error: string | null }>("POST", `/webhooks/${id}/test`, {}),
  retryWebhookDelivery: (id: string, did: string) => req<{ requeued: boolean }>("POST", `/webhooks/${id}/deliveries/${did}/retry`, {}),
  // --- audit enrichment (M3) ---
  auditActions: () => req<string[]>("GET", "/audit/actions"),
  async auditCsv(p: { q?: string; action?: string }): Promise<Blob> {
    const t = auth.token();
    const qs = new URLSearchParams({ format: "csv" });
    if (p.q) qs.set("q", p.q);
    if (p.action) qs.set("action", p.action);
    const res = await fetch(`${BASE}/audit?${qs}`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    if (!res.ok) throw new ApiError(res.status, "error", "Export échoué");
    return res.blob();
  },
  // --- platform settings (M3) ---
  settings: () => req<Record<string, unknown>>("GET", "/settings"),
  setSetting: (key: string, value: unknown) => req<{ key: string; value: unknown }>("PUT", `/settings/${key}`, { value }),
  // --- M4: relances history, forum moderation, integrations ---
  relancesHistory: (courseId: string, p: { page?: number; pageSize?: number }) => reqPaged<Paged<RelanceRow>>(`/analytics/courses/${courseId}/relances`, p),
  threads: (cohortId: string) => req<ForumThreadRow[]>("GET", `/cohorts/${cohortId}/threads`),
  thread: (id: string) => req<ThreadDetail>("GET", `/threads/${id}`),
  deleteForumPost: (id: string) => req<unknown>("DELETE", `/posts/${id}`),
  setThreadFlags: (id: string, b: { locked?: boolean; pinned?: boolean }) => req<ForumThreadRow>("POST", `/threads/${id}/flags`, b),
  integrationsStatus: () => req<IntegrationsStatus>("GET", "/integrations/status"),
  addLtiPlatform: (b: { name?: string; issuer: string; clientId: string; deploymentId?: string; authLoginUrl: string; jwksUrl: string; tokenUrl?: string }) => req<unknown>("POST", "/lti/platforms", b),
  scimToken: (orgId: string) => req<{ token: string; endpoint: string }>("POST", `/organizations/${orgId}/scim/token`, {}),
  // --- bulk user import (M3) ---
  importUsers: (rows: { name?: string; email?: string; role?: string }[], opts: { courseId?: string; invite?: boolean } = {}) =>
    req<ImportReport>("POST", "/users/import", { rows, ...opts }),
  evaluations: () => req<EvalQueueItem[]>("GET", "/evaluations"),
  project: (enrollmentId: string) => req<ProjectDetail>("GET", `/enrollments/${enrollmentId}/project`),
  gradeProject: (enrollmentId: string, body: { criteria: { index: number; points: number; evidence?: string }[]; notes?: string }) => req<unknown>("POST", `/enrollments/${enrollmentId}/evaluation`, body),
  assignEvaluator: (enrollmentId: string, evaluatorId: string, f2fConflict?: boolean) => req<unknown>("POST", `/enrollments/${enrollmentId}/project/assign`, { evaluatorId, f2fConflict }),
  accreditations: () => req<Accreditation[]>("GET", "/accreditations"),
  grantAccreditation: (evaluatorId: string, courseId: string, notes?: string) => req<Accreditation>("POST", "/accreditations", { evaluatorId, courseId, notes }),
  revokeAccreditation: (id: string) => req<unknown>("DELETE", `/accreditations/${id}`),
  credentials: () => req<CredentialRow[]>("GET", "/credentials"),
  revokeCredential: (id: string, reason: string) => req<unknown>("POST", `/credentials/${id}/revoke`, { reason }),
  course: (id: string) => req<CourseFull>("GET", `/courses/${id}`),
  validateCourse: (content: unknown) => req<ValidateResult>("POST", "/courses/validate", { content }),
  createCourse: (slug: string, content: unknown) => req<{ id: string }>("POST", "/courses", { slug, content }),
  newVersion: (courseId: string, content: unknown) => req<{ id: string; version: number; status: string }>("POST", `/courses/${courseId}/versions`, { content }),
  submitReview: (versionId: string) => req<unknown>("POST", `/versions/${versionId}/submit-review`, {}),
  reviewVersion: (versionId: string, decision: "approve" | "request_changes", notes?: string) => req<{ status: string }>("POST", `/versions/${versionId}/review`, { decision, notes }),
  publishVersion: (versionId: string, feedBank = false) => req<unknown>("POST", `/versions/${versionId}/publish`, { feedBank }),
  issuer: () => req<Issuer>("GET", "/credentials/issuer"),
  webhooks: () => req<Webhook[]>("GET", "/webhooks"),
};

export type Issuer = { name: string; url: string; id: string };
export type Webhook = { id: string; url: string; events?: string[]; organizationId?: string | null; active?: boolean; secret?: string; createdAt?: string };

export type ValidationIssue = { level: "error" | "warning"; rule: string; path: string; message: string };
export type ValidateResult = { shape: { ok: boolean; issues?: ValidationIssue[] }; policy?: { ok: boolean; issues: ValidationIssue[] } };

export type CourseVersionFull = { id: string; version: number; status: string; title: string; level: string; domainLabel?: string; passThreshold?: number; publishedAt: string | null; updatedAt: string; content: { blocks?: { index: number; type: string; title: string; payload?: Record<string, unknown> }[] } };
export type CourseFull = { id: string; slug: string; versions: CourseVersionFull[] };

/** Title of the latest published (or newest) version of a course. */
export function courseTitle(c: CourseSummary): string {
  const pub = c.versions.find((v) => v.status === "PUBLISHED") ?? c.versions[0];
  return pub?.title ?? c.slug;
}
