/**
 * rgpd.ts — pure helpers for the RGPD (GDPR) data-rights features. No I/O, so
 * the tricky bits (what "anonymise" scrubs; how raw refresh-token rows collapse
 * into one line per device) are unit-tested in isolation.
 */

/** Synthetic domain for anonymised e-mails — never routable, keeps the unique constraint. */
export const ANON_EMAIL_DOMAIN = "anonymized.invalid";

/**
 * The exact field patch applied to a User on erasure-by-anonymisation (Art. 17).
 * Direct identifiers are scrubbed and auth is neutralised; the row itself stays
 * so de-identified learning history (enrolments, progress) remains consistent.
 */
export function anonymizedUserPatch(userId: string, now: Date = new Date()) {
  return {
    email: `anonymized-${userId}@${ANON_EMAIL_DOMAIN}`,
    name: "Compte supprimé",
    phone: null,
    passwordHash: null,
    totpSecret: null,
    totpEnabledAt: null,
    totpBackupCodes: [] as string[],
    failedLoginCount: 0,
    lockedUntil: null,
    disabledAt: now,
    anonymizedAt: now,
  };
}

/** A raw active-refresh-token row, as needed to summarise a session. */
export type SessionRow = {
  familyId: string;
  userAgent: string | null;
  ip: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export type SessionSummary = {
  familyId: string;
  device: string;
  ip: string | null;
  lastUsedAt: Date;
  createdAt: Date;
  current: boolean;
};

/** Best-effort, dependency-free device label from a User-Agent string. */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return "Appareil inconnu";
  const ua = userAgent;
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Navigateur";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /iPhone|iPad|iOS/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

/**
 * Collapse active token rows (rotation can leave several per family) into one
 * line per device, newest activity first. `currentFamilyId` flags the caller's
 * own session so the UI can label it and protect it from accidental revocation.
 */
export function summarizeSessions(rows: SessionRow[], currentFamilyId?: string): SessionSummary[] {
  const byFamily = new Map<string, SessionRow>();
  for (const r of rows) {
    const seen = byFamily.get(r.familyId);
    const activity = r.lastUsedAt ?? r.createdAt;
    if (!seen || activity > (seen.lastUsedAt ?? seen.createdAt)) byFamily.set(r.familyId, r);
  }
  return [...byFamily.values()]
    .map((r) => ({
      familyId: r.familyId,
      device: describeDevice(r.userAgent),
      ip: r.ip,
      lastUsedAt: r.lastUsedAt ?? r.createdAt,
      createdAt: r.createdAt,
      current: !!currentFamilyId && r.familyId === currentFamilyId,
    }))
    .sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime());
}
