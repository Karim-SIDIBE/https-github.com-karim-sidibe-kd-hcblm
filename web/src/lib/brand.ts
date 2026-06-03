/**
 * brand.ts — per-deployment display branding (white-label).
 *
 * The product is K-LMS (the generic platform, sellable to other clients). Each
 * deployment sets its own public-facing name via build-time env vars; the
 * defaults below target the KOMPETENCES AFRICA deployment: the platform is
 * "DECLICK DIGITAL", operated by the "KOMPETENCES DECLICK" department, with
 * credentials issued by "KOMPETENCES AFRICA".
 *
 * To rebrand for another client, set VITE_BRAND_* at build time — no code edits.
 */
export const brand = {
  /** Public platform name shown to learners (the app's name). */
  name: (import.meta.env.VITE_BRAND_NAME as string | undefined)?.trim() || "DECLICK DIGITAL",
  /** Operating department, shown as attribution under the name. */
  operator: (import.meta.env.VITE_BRAND_OPERATOR as string | undefined)?.trim() || "KOMPETENCES DECLICK",
  /** Entity that officially certifies (issuer on certificates / Open Badges). */
  issuer: (import.meta.env.VITE_BRAND_ISSUER as string | undefined)?.trim() || "KOMPETENCES AFRICA",
};

/** Split the name for the two-tone wordmark: first word plain, rest accented. */
export function brandWordmark(name = brand.name): { head: string; accent: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { head: name, accent: "" };
  return { head: parts[0]!, accent: parts.slice(1).join(" ") };
}
