/**
 * api.ts — typed API client: Bearer access token + transparent refresh.
 */
export type Tokens = { access?: string; refresh?: string };
export type TokenBox = { get(): Tokens; set(t: Tokens): void };

export type EnrollmentSummary = {
  id: string;
  status: string;
  course: { slug: string; title: string; level: string };
  blocksTotal: number;
  blocksCompleted: number;
  progressPercent: number;
  lastSeenAt: string | null;
  startedAt: string;
};

export type CatalogItem = { courseId: string; slug: string; title: string; level: string; enrolled: boolean };

export type ConsentState = { type: string; label: string; required: boolean; currentVersion: string; granted: boolean; acceptedVersion: string | null; grantedAt: string | null };

export function createApi(baseUrl: string, tokens: TokenBox) {
  async function refresh(): Promise<boolean> {
    const r = tokens.get().refresh;
    if (!r) return false;
    const res = await fetch(`${baseUrl}/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: r }) });
    if (!res.ok) return false;
    const j = await res.json();
    tokens.set({ access: j.accessToken, refresh: j.refreshToken });
    return true;
  }

  async function raw(method: string, path: string, opts: { body?: unknown; auth?: boolean; headers?: Record<string, string> } = {}): Promise<Response> {
    const auth = opts.auth !== false;
    const build = (): RequestInit => {
      const headers: Record<string, string> = { ...opts.headers };
      if (opts.body !== undefined) headers["content-type"] = "application/json";
      const t = tokens.get().access;
      if (auth && t) headers["authorization"] = `Bearer ${t}`;
      return { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined };
    };
    let res = await fetch(baseUrl + path, build());
    if (res.status === 401 && auth && (await refresh())) res = await fetch(baseUrl + path, build());
    return res;
  }

  return {
    raw,
    async login(email: string, password: string) {
      const res = await fetch(`${baseUrl}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(j.message || "Identifiants invalides"), { code: j.error as string | undefined });
      tokens.set({ access: j.accessToken, refresh: j.refreshToken });
      return j.user as { id: string; name: string; email: string; role: string };
    },
    /** B2C self-registration → sends an OTP; no session yet. */
    async register(body: { name: string; email: string; password: string; phone?: string; acceptTerms?: boolean; marketingOptIn?: boolean }) {
      const res = await fetch(`${baseUrl}/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(j.message || "Inscription impossible"), { code: j.error as string | undefined });
      return j.data as { verificationRequired: boolean; email: string };
    },
    /** Verify the OTP → issues a session (auto-login). */
    async verify(email: string, code: string) {
      const res = await fetch(`${baseUrl}/auth/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(j.message || "Code invalide"), { code: j.error as string | undefined });
      tokens.set({ access: j.accessToken, refresh: j.refreshToken });
      return j.user as { id: string; name: string; email: string; role: string };
    },
    async resendVerification(email: string) {
      await fetch(`${baseUrl}/auth/resend-verification`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    },
    async forgotPassword(email: string) {
      await fetch(`${baseUrl}/auth/forgot-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    },
    /** Reset with the code → clears lockout and logs in. */
    async resetPassword(email: string, code: string, password: string) {
      const res = await fetch(`${baseUrl}/auth/reset-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code, password }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(j.message || "Réinitialisation impossible"), { code: j.error as string | undefined });
      tokens.set({ access: j.accessToken, refresh: j.refreshToken });
      return j.user as { id: string; name: string; email: string; role: string };
    },
    async me() { return (await (await raw("GET", "/auth/me")).json()).data; },
    // --- RGPD self-service ---
    async consents(): Promise<ConsentState[]> { return (await (await raw("GET", "/me/consents")).json()).data as ConsentState[]; },
    async setConsent(type: string, granted: boolean) {
      const res = await raw("POST", "/me/consents", { body: { type, granted } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Erreur"); return j.data;
    },
    /** Raw JSON text of my data, for a client-side download. */
    async exportMyData(): Promise<string> { return (await raw("GET", "/me/export")).text(); },
    async deleteAccount(mode: "anonymize" | "delete" = "anonymize") {
      const res = await raw("POST", "/me/delete-account", { body: { mode } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Erreur"); return j.data as { purgeAt: string };
    },
    /** Authenticated fetch of an arbitrary (media) URL for offline caching. */
    async cacheFetch(url: string): Promise<Response> {
      const abs = new URL(url, baseUrl).href;
      const t = tokens.get().access;
      return fetch(abs, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    },
    async get<T = any>(path: string): Promise<T> { return (await (await raw("GET", path)).json()).data as T; },
    async post<T = any>(path: string, body?: unknown): Promise<T> { return (await (await raw("POST", path, { body })).json()).data as T; },
    async listEnrollments(): Promise<EnrollmentSummary[]> {
      const res = await raw("GET", "/enrollments");
      if (!res.ok) return [];
      return ((await res.json()).data ?? []) as EnrollmentSummary[];
    },
    resume(enrollmentId: string) { return this.get(`/enrollments/${enrollmentId}/resume`); },
    block(enrollmentId: string, index: number) { return this.get(`/enrollments/${enrollmentId}/blocks/${index}`); },
    project(enrollmentId: string) { return this.get(`/enrollments/${enrollmentId}/project`); },
    notifications(enrollmentId: string) { return this.get(`/enrollments/${enrollmentId}/notifications`); },
    async mediaPlayback(mediaId: string) {
      const data = await this.get<any>(`/media/${mediaId}/playback`);
      // The manifest returns API-relative URLs; make them absolute against the API
      // origin so a native <video> works even when the PWA is on another subdomain.
      const abs = (u?: string | null) => (u ? new URL(u, baseUrl).href : u);
      if (Array.isArray(data?.renditions)) data.renditions = data.renditions.map((r: any) => ({ ...r, url: abs(r.url) }));
      if (Array.isArray(data?.captions)) data.captions = data.captions.map((c: any) => ({ ...c, url: abs(c.url) }));
      return data;
    },
    async getOfflineBundle(enrollmentId: string, etag?: string) {
      const res = await raw("GET", `/enrollments/${enrollmentId}/offline-bundle`, etag ? { headers: { "if-none-match": `"${etag}"` } } : {});
      if (res.status === 304) return { status: 304 as const };
      const j = await res.json();
      return { status: res.status, bundle: j.data };
    },
    async sync(enrollmentId: string, actions: unknown[]) {
      const res = await raw("POST", `/enrollments/${enrollmentId}/sync`, { body: { actions } });
      return (await res.json()).data;
    },
    async progress(enrollmentId: string) {
      return (await (await raw("GET", `/enrollments/${enrollmentId}`)).json()).data;
    },
    async catalog(): Promise<CatalogItem[]> {
      const res = await raw("GET", "/catalog");
      if (!res.ok) return [];
      return ((await res.json()).data ?? []) as CatalogItem[];
    },
    /** Self-enrol the caller into a catalogue course; returns the new enrolment. */
    async selfEnroll(courseId: string): Promise<{ id: string }> {
      const res = await raw("POST", "/enrollments/self", { body: { courseId } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Inscription impossible");
      return j.data as { id: string };
    },
    /** Register/unregister this device's push token (native app). Best-effort. */
    async registerDevice(token: string, platform: string): Promise<void> {
      try { await raw("POST", "/me/devices", { body: { token, platform } }); } catch { /* offline / not logged in */ }
    },
    async unregisterDevice(token: string): Promise<void> {
      try { await raw("DELETE", "/me/devices", { body: { token } }); } catch { /* best-effort */ }
    },
  };
}

export type Api = ReturnType<typeof createApi>;
