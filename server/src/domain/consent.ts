/**
 * consent.ts — pure consent logic (RGPD Art. 6/7). The catalogue of policies and
 * how a stack of consent rows collapses into the current state per type. No I/O.
 */

/** The policies we ask consent for, with their current version. Bump `version`
 * when the underlying document changes — users are then re-prompted. */
export const CONSENT_POLICIES = {
  terms: { version: "2026-06", required: true, label: "Conditions générales d'utilisation" },
  privacy: { version: "2026-06", required: true, label: "Politique de confidentialité" },
  marketing: { version: "2026-06", required: false, label: "Communications (offres, nouveautés)" },
} as const;

export type ConsentType = keyof typeof CONSENT_POLICIES;
export const CONSENT_TYPES = Object.keys(CONSENT_POLICIES) as ConsentType[];
export const isConsentType = (t: string): t is ConsentType => t in CONSENT_POLICIES;

/** A stored consent row (only the fields the pure logic needs). */
export type ConsentRow = { type: string; version: string; grantedAt: Date; revokedAt: Date | null };

export type ConsentState = {
  type: ConsentType;
  label: string;
  required: boolean;
  currentVersion: string;
  granted: boolean;        // active consent to the CURRENT policy version
  acceptedVersion: string | null;
  grantedAt: Date | null;
};

/** Current consent state for every policy, from the user's full row history. */
export function currentConsentState(rows: ConsentRow[]): ConsentState[] {
  return CONSENT_TYPES.map((type) => {
    const policy = CONSENT_POLICIES[type];
    const latest = rows
      .filter((r) => r.type === type)
      .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime())[0];
    const active = !!latest && latest.revokedAt === null;
    return {
      type, label: policy.label, required: policy.required, currentVersion: policy.version,
      // "granted" requires an active consent to the *current* version (re-prompt on bump).
      granted: active && latest!.version === policy.version,
      acceptedVersion: active ? latest!.version : null,
      grantedAt: active ? latest!.grantedAt : null,
    };
  });
}
