/**
 * injection.ts — Moment d'Ancrage (PAM) re-injection at render time.
 *
 * The content document stores the literal token `{{moment_ancrage}}` at the
 * mandated touchpoints (enforced by the publish gate). At render time, for a
 * given enrolment, every occurrence is replaced by the learner's captured PAM
 * text. This is the "fil rouge" the spec requires — storing the PAM without
 * re-injecting it is explicitly a non-implementation of the model.
 */
import { MOMENT_ANCRAGE_TOKEN } from "../content-model.js";

/** Replace the PAM token throughout an arbitrary JSON value. The learner's
 *  words are QUOTED (« … », like the badge messages) so they read as a
 *  citation inside the surrounding prompt, not as part of the sentence. */
export function injectMomentAncrage<T>(value: T, momentAncrage: string | null | undefined): T {
  const pam = (momentAncrage ?? "").trim();
  const replacement = pam.length > 0 ? `« ${pam} »` : "votre situation décrite au Bloc 0";

  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      return v.includes(MOMENT_ANCRAGE_TOKEN) ? v.split(MOMENT_ANCRAGE_TOKEN).join(replacement) : v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
      return out;
    }
    return v;
  };

  return walk(value) as T;
}

/** True if any string in the value still contains the token. */
export function containsToken(value: unknown): boolean {
  if (typeof value === "string") return value.includes(MOMENT_ANCRAGE_TOKEN);
  if (Array.isArray(value)) return value.some(containsToken);
  if (value && typeof value === "object") return Object.values(value).some(containsToken);
  return false;
}
