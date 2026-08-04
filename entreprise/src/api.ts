/**
 * api.ts — enterprise console client. Same backend as the rest of the platform,
 * but only the org-scoped surface (an org admin can act on their own org only).
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "http://localhost:4000/api/v1";
const TOKEN_KEY = "kd_ent_token";
const USER_KEY = "kd_ent_user";

export type Principal = { id: string; name: string; email: string; role: string };

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

// --- types ---
export type Org = { id: string; name: string; slug: string; seats: number; _count?: { memberships: number; courses: number } };
export type Seats = { seats: number; used: number; available: number };
export type Member = {
  id: string; orgRole: "OWNER" | "ADMIN" | "MEMBER"; createdAt: string;
  user: { id: string; name: string; email: string; role: string; disabledAt: string | null };
};
export type CourseSummary = { id: string; slug: string; versions: { version: number; status: string; title: string; level: string }[] };
export type NewLearner = { id: string; name: string; email: string; role: string; phone: string | null; createdAt: string; invited: boolean };
export type ProgressRow = {
  userId: string; name: string; email: string; disabled: boolean; active7d: boolean;
  enrollments: { courseTitle: string; progressPercent: number; status: string; lastActivity: string | null; startedAt: string }[];
};

export const api = {
  myOrgs: () => req<Org[]>("GET", "/organizations"),
  seats: (orgId: string) => req<Seats>("GET", `/organizations/${orgId}/seats`),
  members: (orgId: string) => req<Member[]>("GET", `/organizations/${orgId}/members`),
  createLearner: (orgId: string, b: { name: string; email: string; password?: string; invite?: boolean }) =>
    req<NewLearner>("POST", `/organizations/${orgId}/learners`, b),
  setDisabled: (orgId: string, userId: string, disabled: boolean) =>
    req<{ userId: string; disabled: boolean }>("PATCH", `/organizations/${orgId}/learners/${userId}`, { disabled }),
  enroll: (orgId: string, userId: string, courseId: string) =>
    req<{ id: string }>("POST", `/organizations/${orgId}/enrollments`, { userId, courseId }),
  courses: () => req<CourseSummary[]>("GET", "/courses"),
  progress: (orgId: string) => req<ProgressRow[]>("GET", `/organizations/${orgId}/progress`),
  resendInvite: (orgId: string, userId: string) => req<{ delivered: boolean; tempPassword: string }>("POST", `/organizations/${orgId}/learners/${userId}/invite`, {}),
  async progressCsv(orgId: string): Promise<Blob> {
    const t = auth.token();
    const res = await fetch(`${BASE}/organizations/${orgId}/progress?format=csv`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    if (!res.ok) throw new ApiError(res.status, "error", "Export échoué");
    return res.blob();
  },
};

// --- helpers ---
/** A strong, human-typable random password (no ambiguous chars).
 *  Crypto-grade randomness (getRandomValues) — Math.random is not suitable
 *  for credentials. Rejection sampling keeps the picks unbiased. */
export function genPassword(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ", a = "abcdefghijkmnpqrstuvwxyz", n = "23456789", s = "!@#$%&*";
  const all = A + a + n + s;
  const rand = (max: number): number => {
    const limit = Math.floor(0x100000000 / max) * max; // reject to avoid modulo bias
    const buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  };
  const pick = (set: string) => set[rand(set.length)];
  const chars = [pick(A), pick(a), pick(n), pick(s)];
  for (let i = 0; i < 8; i++) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) { // Fisher–Yates, crypto-seeded
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** First published version's title for a course (for the enrol dropdown). */
export function publishedCourse(c: CourseSummary): { title: string; level: string } | null {
  const v = c.versions.find((x) => x.status === "PUBLISHED");
  return v ? { title: v.title, level: v.level } : null;
}
