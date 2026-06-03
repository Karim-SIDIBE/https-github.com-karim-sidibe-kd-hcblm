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
      if (!res.ok) throw new Error("Identifiants invalides");
      const j = await res.json();
      tokens.set({ access: j.accessToken, refresh: j.refreshToken });
      return j.user as { id: string; name: string; email: string; role: string };
    },
    async me() { return (await (await raw("GET", "/auth/me")).json()).data; },
    /** Authenticated fetch of an arbitrary (media) URL for offline caching. */
    async cacheFetch(url: string): Promise<Response> {
      const abs = new URL(url, baseUrl).href;
      const t = tokens.get().access;
      return fetch(abs, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    },
    async get<T = any>(path: string): Promise<T> { return (await (await raw("GET", path)).json()).data as T; },
    async listEnrollments(): Promise<EnrollmentSummary[]> {
      const res = await raw("GET", "/enrollments");
      if (!res.ok) return [];
      return ((await res.json()).data ?? []) as EnrollmentSummary[];
    },
    resume(enrollmentId: string) { return this.get(`/enrollments/${enrollmentId}/resume`); },
    block(enrollmentId: string, index: number) { return this.get(`/enrollments/${enrollmentId}/blocks/${index}`); },
    project(enrollmentId: string) { return this.get(`/enrollments/${enrollmentId}/project`); },
    notifications(enrollmentId: string) { return this.get(`/enrollments/${enrollmentId}/notifications`); },
    mediaPlayback(mediaId: string) { return this.get(`/media/${mediaId}/playback`); },
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
  };
}

export type Api = ReturnType<typeof createApi>;
