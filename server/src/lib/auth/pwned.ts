/**
 * pwned.ts — block passwords found in known breaches (Have I Been Pwned).
 *
 * Uses HIBP's **k-anonymity** range API: only the first 5 hex chars of the
 * password's SHA-1 ever leave the server — never the password, never any
 * identity. RGPD-friendly. Graceful by design: any error (or opt-out via
 * PASSWORD_BREACH_CHECK=false) returns `false`, so it never blocks sign-up.
 */
import { createHash } from "node:crypto";
import { env } from "../../config/env.js";

/** Pure: is `suffix` (35 hex chars) present in a HIBP range response body? */
export function isSuffixPwned(rangeBody: string, suffix: string): boolean {
  const want = suffix.toUpperCase();
  for (const line of rangeBody.split(/\r?\n/)) {
    const hash = line.split(":")[0]?.trim().toUpperCase();
    if (hash && hash === want) return true;
  }
  return false;
}

export async function isPasswordPwned(password: string): Promise<boolean> {
  if (!env.PASSWORD_BREACH_CHECK) return false;
  try {
    const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" }, // length-hiding padding (privacy)
      signal: AbortSignal.timeout(2500), // never hang an account flow
    });
    if (!res.ok) return false;
    return isSuffixPwned(await res.text(), suffix);
  } catch {
    return false; // network/timeout/DNS — fail open, don't block the user
  }
}
