/**
 * api.ts — client du front FACE2FACE. Même backend que le reste de la
 * plateforme ; seule la surface /f2f (présentiel K-SPEM) est consommée,
 * plus l'authentification et deux lectures transverses (cours pour la
 * grille du socle, annuaire pour le choix du formateur).
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "http://localhost:4000/api/v1";
const TOKEN_KEY = "kd_f2f_token";
const REFRESH_KEY = "kd_f2f_refresh";
const USER_KEY = "kd_f2f_user";

export type Principal = { id: string; name: string; email: string; role: string };

export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY),
  refreshToken: () => localStorage.getItem(REFRESH_KEY),
  user: (): Principal | null => { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } },
  set: (token: string, refresh: string | null, user: Principal) => {
    localStorage.setItem(TOKEN_KEY, token);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); localStorage.removeItem(USER_KEY); },
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

// Rafraîchissement silencieux : l'accès expire vite (15 min), le refresh token
// prolonge la session sans reconnexion — même mécanique que la PWA. Une seule
// tentative en vol à la fois (les 401 simultanés partagent la même promesse).
let refreshing: Promise<boolean> | null = null;
function refreshAccess(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const r = auth.refreshToken();
      if (!r) return false;
      const res = await fetch(`${BASE}/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: r }) });
      if (!res.ok) return false;
      const j = await res.json();
      const user = auth.user();
      if (user) auth.set(j.accessToken, j.refreshToken ?? null, user);
      return true;
    } catch { return false; }
    finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const build = (): RequestInit => {
    const headers: Record<string, string> = {};
    const t = auth.token();
    if (t) headers["authorization"] = `Bearer ${t}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    return { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined };
  };
  let res = await fetch(BASE + path, build());
  if (res.status === 401 && (await refreshAccess())) res = await fetch(BASE + path, build());
  if (res.status === 401) { auth.clear(); location.reload(); throw new ApiError(401, "unauthorized", "Session expirée"); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error || "error", json.message || "Erreur serveur");
  return (json.data ?? json) as T;
}

export type LoginResult =
  | { accessToken: string; refreshToken: string | null; user: Principal }
  | { twoFactorRequired: true; challenge: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error || "error", j.message || "Identifiants invalides");
  if (j.twoFactorRequired) return { twoFactorRequired: true, challenge: j.challenge };
  return { accessToken: j.accessToken, refreshToken: j.refreshToken ?? null, user: j.user };
}

export async function verify2fa(challenge: string, code: string): Promise<{ accessToken: string; refreshToken: string | null; user: Principal }> {
  const res = await fetch(`${BASE}/auth/2fa/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code, challenge }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error || "error", j.message || "Code invalide");
  return { accessToken: j.accessToken, refreshToken: j.refreshToken ?? null, user: j.user };
}

// --- types (miroir de server/src/modules/f2f) ---

export type Shape = { sessions: number; periods: number; journalMin: number; label: string };
export type UserRef = { id: string; name: string; email: string };

export type MyModule = { participantId: string; status: string; module: { id: string; title: string; level: number; location: string | null; shape: Shape } };

export type SessionView = { index: number; title: string; scheduledAt: string | null; heldAt: string | null; present: boolean };
export type Anchor = { situation: string; behaviorChange: string; beneficiary: string; updatedAt: string; frozen: boolean };
export type JournalEntry = { id: string; periodIndex: number; entryIndex: number; entryDate: string; situation: string; action: string; observation: string; learning: string; createdAt: string };
export type Mission = { id: string; sessionIndex: number; text: string; peerName: string | null; engagedAt: string };
export type Certification = { decision: string; scoreTotal: number; feedback: string | null; evaluatedAt: string; scores?: { label: string; weightPoints: number; points: number; evidence: string | null }[] };

export type SelfPhase = { score: number; comment: string | null; updatedAt: string; frozen: boolean } | null;
export type SelfAssessment = { entry: SelfPhase; exit: SelfPhase; delta: number | null; entryOpen: boolean; exitOpen: boolean };

export type JournalSlot = { entryIndex: number; opensAt: string | null; open: boolean; entry: JournalEntry | null };
export type Cycle = { index: number; sessionHeldAt: string | null; mission: Mission | null; journal: JournalSlot[] };

export type Overview = {
  id: string; status: string; user: UserRef;
  module: { id: string; title: string; level: number; location: string | null; shape: Shape; sessions: SessionView[] };
  anchor: Anchor | null;
  journal: { entries: JournalEntry[]; count: number; target: number };
  missions: Mission[];
  cycles: Cycle[];
  certification: Certification | null;
  credential: { id: string; issuedAt: string } | null;
  selfAssessment: SelfAssessment;
};

export type Prereq = { code: string; label: string; ok: boolean };
export type CertState = { ok: boolean; prereqs: Prereq[]; alreadyCertified: boolean; decision: string | null };

export type ModuleRow = {
  id: string; title: string; level: number; status: string; location: string | null; createdAt: string;
  trainer: { id: string; name: string } | null; shape: Shape;
  sessions: { index: number; title: string; scheduledAt: string | null; heldAt: string | null }[];
  _count: { participants: number };
};

export type ModuleSession = {
  id: string; index: number; title: string; scheduledAt: string | null; heldAt: string | null;
  location: string | null; durationMin: number;
  attendance: { participantId: string; present: boolean; note: string | null }[];
};

export type ParticipantRow = {
  id: string; user: UserRef; status: string; joinedAt: string;
  anchor: { deposited: boolean; updatedAt?: string };
  journalCount: number; journalTarget: number; missionCount: number;
  presentAt: number[];
  certification: { decision: string; scoreTotal: number; evaluatedAt: string } | null;
  credential: { id: string; issuedAt: string } | null;
};

export type ModuleDetail = {
  id: string; title: string; level: number; status: string; location: string | null;
  trainer: UserRef | null; shape: Shape; rubric: Rubric;
  sessions: ModuleSession[]; participants: ParticipantRow[];
};

// Grille du socle commun (miroir de @kd/shared RubricSchema).
export type RubricBand = { band: number; scoreRange: [number, number]; descriptor: string };
export type RubricCriterion = { label: string; competencyCode?: string; weightPoints: number; minPoints?: number; whereToLook?: string; bands?: RubricBand[] };
export type Rubric = { criteria: RubricCriterion[]; totalPoints: number; threshold: number };

export type CertifyResult = {
  certification: Certification;
  decision: { decision: string; total: number; threshold: number; minimumsMissed: { label: string }[] };
  credential: { id: string } | null;
};

export type ModuleKpis = {
  id: string; title: string; level: number; status: string; shape: Shape;
  participants: number; sessionsHeld: number; presenceRatePct: number | null;
  journal: { total: number; avgPerParticipant: number | null; target: number; onTrack: number };
  missions: { engaged: number; expected: number };
  anchors: number;
  certification: { decided: number; certified: number; resubmit: number; notCertified: number; avgScore: number | null };
  selfAssessment: { avgEntry: number | null; avgExit: number | null; avgDelta: number | null; pairs: number };
};
export type Kpis = {
  global: { modules: number; activeModules: number; participants: number; certified: number; certificationRatePct: number | null; journalEntries: number; avgDelta: number | null };
  modules: ModuleKpis[];
};

export type CourseSummary = { id: string; slug: string; versions: { version: number; status: string; title: string; level: string }[] };
export type UserRow = { id: string; name: string; email: string; role: string };

export const api = {
  // --- participant ---
  myModules: () => req<MyModule[]>("GET", "/f2f/me/modules"),
  overview: (pid: string) => req<Overview>("GET", `/f2f/participants/${pid}`),
  saveAnchor: (pid: string, b: { situation: string; behaviorChange: string; beneficiary: string }) =>
    req<Anchor>("PUT", `/f2f/participants/${pid}/anchor`, b),
  addJournal: (pid: string, b: { periodIndex: number; entryIndex: number; entryDate: string; situation: string; action: string; observation: string; learning: string }) =>
    req<JournalEntry>("POST", `/f2f/participants/${pid}/journal`, b),
  addMission: (pid: string, b: { sessionIndex: number; text: string; peerName?: string }) =>
    req<Mission>("POST", `/f2f/participants/${pid}/missions`, b),
  certState: (pid: string) => req<CertState>("GET", `/f2f/participants/${pid}/certification-state`),
  saveSelfAssessment: (pid: string, b: { phase: "ENTRY" | "EXIT"; score: number; comment?: string }) =>
    req<{ score: number }>("PUT", `/f2f/participants/${pid}/self-assessment`, b),
  kpis: () => req<Kpis>("GET", "/f2f/kpis"),
  async certificatePdf(pid: string): Promise<Blob> {
    const t = auth.token();
    const res = await fetch(`${BASE}/f2f/participants/${pid}/certificate.pdf`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    if (!res.ok) throw new ApiError(res.status, "error", "Certificat indisponible");
    return res.blob();
  },
  verifyUrl: (credentialId: string) => `${BASE}/credentials/${encodeURIComponent(credentialId)}`,

  // --- formateur / staff ---
  modules: () => req<ModuleRow[]>("GET", "/f2f/modules"),
  module: (id: string) => req<ModuleDetail>("GET", `/f2f/modules/${id}`),
  createModule: (b: { title: string; level: number; location?: string; trainerId?: string; rubric: Rubric; sessions?: { index: number; scheduledAt?: string }[] }) =>
    req<ModuleRow>("POST", "/f2f/modules", b),
  addParticipant: (moduleId: string, b: { email: string; name?: string }) =>
    req<{ id: string; user: UserRef; invited: boolean; accountCreated: boolean }>("POST", `/f2f/modules/${moduleId}/participants`, b),
  holdSession: (sessionId: string, attendance: { participantId: string; present: boolean; note?: string }[]) =>
    req<ModuleSession>("POST", `/f2f/sessions/${sessionId}/hold`, { attendance }),
  cancelHold: (sessionId: string) => req<ModuleSession>("DELETE", `/f2f/sessions/${sessionId}/hold`),
  deleteModule: (moduleId: string) => req<{ id: string; title: string }>("DELETE", `/f2f/modules/${moduleId}`),
  certify: (pid: string, b: { criteria: { points: number; evidence?: string }[]; feedback?: string }) =>
    req<CertifyResult>("POST", `/f2f/participants/${pid}/certify`, b),

  // --- transverses (création de module) ---
  courses: () => req<CourseSummary[]>("GET", "/courses"),
  course: (id: string) => req<{ id: string; slug: string; versions: { version: number; status: string; title: string; content: unknown }[] }>("GET", `/courses/${id}`),
  users: (q: string) => req<UserRow[]>("GET", `/users?q=${encodeURIComponent(q)}`),
};

/** Extrait la grille du socle (Bloc 4) d'un contenu de cours publié. */
export function rubricFromCourseContent(content: unknown): Rubric | null {
  const blocks = (content as { blocks?: { type?: string; payload?: { rubric?: Rubric } }[] } | null)?.blocks;
  const cert = blocks?.find((b) => b.type === "CERTIFICATION");
  return cert?.payload?.rubric ?? null;
}

/** Rôles accueillis dans la console formateur (mêmes familles que le serveur). */
export function isStaffRole(role: string): boolean {
  return ["SUPER_ADMIN", "COURSE_ADMIN", "INSTRUCTOR", "EVALUATOR"].includes(role);
}
export const canCreateModule = (role: string) => ["SUPER_ADMIN", "COURSE_ADMIN"].includes(role);
export const canGrade = (role: string) => ["SUPER_ADMIN", "EVALUATOR"].includes(role);

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
