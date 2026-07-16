/**
 * uitexts.service.ts — super-admin overrides of the learner-app interface texts.
 *
 * The complete FR/EN copy lives as data in @kd/shared/ui-texts (the defaults);
 * only EDITED keys are stored here, keyed (app, locale, key). Deleting a row
 * reverts the text to its default. The learner PWA fetches the override map at
 * boot (public read) and overlays it on the shared defaults.
 */
import { UI_TEXT_DEFAULTS, type UiLang } from "@kd/shared/ui-texts";
import { prisma } from "../../db/prisma.js";

export class UiTextError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

const LOCALES: UiLang[] = ["fr", "en"];

/** Override map for one app: { fr: {key: value}, en: {key: value} }. */
export async function overridesFor(app: string): Promise<Record<UiLang, Record<string, string>>> {
  const rows = await prisma.uiText.findMany({ where: { app } });
  const out: Record<UiLang, Record<string, string>> = { fr: {}, en: {} };
  for (const r of rows) {
    if (r.locale === "fr" || r.locale === "en") out[r.locale][r.key] = r.value;
  }
  return out;
}

/** Placeholders ({var}) used in a text — an override must keep them all. */
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

export async function setUiText(app: string, locale: UiLang, key: string, value: string, updatedById?: string) {
  if (!LOCALES.includes(locale)) throw new UiTextError(422, "bad_locale", "Langue inconnue (fr/en)");
  const defaults = UI_TEXT_DEFAULTS[locale];
  const def = defaults[key];
  if (def === undefined) throw new UiTextError(404, "unknown_key", `Clé inconnue : ${key}`);
  const trimmed = value.trim();
  if (!trimmed) throw new UiTextError(422, "empty_value", "Le texte ne peut pas être vide (utilisez « Rétablir » pour revenir au texte d'origine)");
  // The app interpolates {var} placeholders at render time: an override that
  // drops one would silently break the sentence (e.g. missing learner name).
  const missing = placeholders(def).filter((p) => !placeholders(trimmed).includes(p));
  if (missing.length > 0) {
    throw new UiTextError(422, "missing_placeholder", `Le texte doit conserver ${missing.map((p) => `{${p}}`).join(", ")}`);
  }
  return prisma.uiText.upsert({
    where: { app_locale_key: { app, locale, key } },
    create: { app, locale, key, value: trimmed, updatedById: updatedById ?? null },
    update: { value: trimmed, updatedById: updatedById ?? null },
  });
}

/** Revert a text to its default (idempotent). */
export async function resetUiText(app: string, locale: UiLang, key: string): Promise<boolean> {
  const r = await prisma.uiText.deleteMany({ where: { app, locale, key } });
  return r.count > 0;
}
