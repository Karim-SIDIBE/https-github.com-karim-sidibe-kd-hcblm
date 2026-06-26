import { useI18n, type Lang } from "../lib/i18n";

/** Compact FR/EN language toggle. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const langs: Lang[] = ["fr", "en"];
  return (
    <div className="lang-switch" role="group" aria-label="Langue / Language" style={{ display: "inline-flex", gap: 2, border: "1px solid var(--line, #ddd)", borderRadius: 999, padding: 2 }}>
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          title={l === "fr" ? "Français" : "English"}
          style={{
            border: 0, cursor: "pointer", borderRadius: 999,
            padding: compact ? "2px 8px" : "3px 10px", fontSize: compact ? 11 : 12, fontWeight: 700,
            fontFamily: "inherit",
            background: lang === l ? "var(--accent, #F36F21)" : "transparent",
            color: lang === l ? "#fff" : "var(--fg-2, #667)",
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
