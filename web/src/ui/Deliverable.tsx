import { useEffect, useMemo, useState } from "react";
import { engine, store } from "../lib/app";
import { setCachedProgress } from "../lib/cache";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Deliverable — PAM-context written submissions: the Block 2 field application
 * (gated, ≥ minChars) and Block 4 journal entries (≥ minWords). The brief/prompt
 * arrives PAM-injected in the cached bundle content. Queues offline. hf-* kit.
 */
export function Deliverable({ eid, block, itemKey }: { eid: string; block: number; itemKey: string }) {
  const t = useT();
  const [bundle, setBundle] = useState<any>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => { const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid)); if (alive) setBundle(b); })();
    return () => { alive = false; };
  }, [eid]);

  const spec = useMemo(() => {
    if (!bundle) return null;
    const blk = bundle.content.blocks.find((x: any) => x.index === block);
    if (itemKey === "field") {
      const fa = blk?.payload?.fieldApplication;
      return fa ? { kind: "field" as const, eyebrow: t("dl.fieldEyebrow"), title: t("dl.fieldTitle"), brief: fa.brief, min: fa.minChars ?? 200, unit: "caractères", itemType: "FIELD_APPLICATION" } : null;
    }
    const entry = (blk?.payload?.journal?.entries ?? []).find((e: any) => `J+${e.day}` === itemKey);
    return entry ? { kind: "journal" as const, eyebrow: t("jr.eyebrow"), title: t("dl.journalTitle", { key: itemKey }), brief: entry.prompt, min: entry.minWords ?? 50, unit: "mots", itemType: "JOURNAL_ENTRY" } : null;
  }, [bundle, block, itemKey, t]);

  const count = spec?.unit === "mots" ? words(text) : text.trim().length;
  const ok = spec ? count >= spec.min : false;

  async function submit() {
    if (!ok || !spec) return;
    setBusy(true);
    try {
      const r = await engine.commit(eid, "complete_item", { blockIndex: block, itemType: spec.itemType, itemKey, data: { text: text.trim() } });
      if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
      navigate(routes.cours(eid));
    } finally { setBusy(false); }
  }

  const Back = () => <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0 }} onClick={() => navigate(routes.cours(eid))}>{t("nav.backCourse")}</button>;
  if (!bundle) return <div className="stack"><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;
  if (!spec) return <div className="stack"><Back /><p className="banner offline">{t("dl.notFound")}</p></div>;

  return (
    <div className="stack">
      <Back />
      <div><div className="eyebrow">{spec.eyebrow}</div><h1 style={{ marginTop: 6 }}>{spec.title}</h1></div>

      <div className="hf-card hf-card--stripe-orange stack">
        <div className="hf-pam"><span className="tag">{t("mission")}</span><div className="quote" style={{ whiteSpace: "pre-wrap" }}>{spec.brief}</div></div>
        <div className="hf-textwrap">
          <textarea className="hf-field" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("answerPlaceholder")} style={{ minHeight: 180 }}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
          <span className="hf-count" style={{ color: ok ? "var(--brand-declick)" : undefined }}>{count} / {spec.min} {spec.unit === "mots" ? t("dl.unitWords") : t("dl.unitChars")}</span>
        </div>
        <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy || !ok} onClick={submit}>{busy ? "…" : t("dl.submit")}</button>
      </div>
    </div>
  );
}
