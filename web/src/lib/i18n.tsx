/**
 * i18n.tsx — tiny, dependency-free internationalisation for the learner PWA.
 *
 * Matches the app's lean philosophy (no heavy i18n library, like the hand-rolled
 * router). The FR/EN dictionaries live in @kd/shared/ui-texts (single source,
 * also consumed by the admin's « Textes de l'interface » editor); `t(key, vars?)`
 * interpolates {var} placeholders, the language choice persists in localStorage.
 *
 * Super-admin overrides: GET /ui-texts serves the texts edited in the admin
 * console; they overlay the defaults at lookup time and are cached in
 * localStorage so the customised copy also works offline. Missing keys fall
 * back to the override, then the default, then French, then the key itself.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { UI_TEXT_DEFAULTS, type UiDict, type UiLang } from "@kd/shared/ui-texts";

export type Lang = UiLang;
const LS_KEY = "klms_lang";
const OVERRIDES_KEY = "klms_uitexts";
const API_URL = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000/api/v1";

const fr = UI_TEXT_DEFAULTS.fr;
const DICTS: Record<Lang, UiDict> = UI_TEXT_DEFAULTS;

type Overrides = Partial<Record<Lang, UiDict>>;

function readCachedOverrides(): Overrides {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "{}"); } catch { return {}; }
}

/** Fetch the super-admin text overrides (public endpoint, offline-cached). */
async function fetchOverrides(): Promise<Overrides | null> {
  try {
    const res = await fetch(`${API_URL}/ui-texts?app=web`);
    if (!res.ok) return null;
    const data = (await res.json())?.data as Overrides | undefined;
    if (!data) return null;
    try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(data)); } catch { /* quota */ }
    return data;
  } catch { return null; /* offline → cached copy */ }
}

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch { /* no storage */ }
  return (navigator.language || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: TFn }>({
  lang: "fr", setLang: () => {}, t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  const [overrides, setOverrides] = useState<Overrides>(readCachedOverrides);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { void fetchOverrides().then((o) => { if (o) setOverrides(o); }); }, []);
  const setLang = (l: Lang) => { try { localStorage.setItem(LS_KEY, l); } catch { /* quota */ } setLangState(l); };
  const t: TFn = (key, vars) => {
    let s = overrides[lang]?.[key] ?? DICTS[lang][key] ?? overrides.fr?.[key] ?? fr[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    return s;
  };
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
export function useT(): TFn { return useContext(I18nContext).t; }
