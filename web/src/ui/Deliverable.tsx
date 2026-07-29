import { useEffect, useMemo, useState } from "react";
import { engine, store } from "../lib/app";
import { getCachedProgress, setCachedProgress } from "../lib/cache";
import { goNext, nextTarget } from "../lib/nav";
import { navigate, routes } from "../lib/router";
import { Breadcrumb } from "./Breadcrumb";
import { useT } from "../lib/i18n";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

type FieldSpec = { label: string; placeholder?: string };
type StepSpec = { title: string; intro?: string; fields: FieldSpec[] };

/**
 * Deliverable — PAM-context written submissions: the Block 2 field application
 * (gated, ≥ minChars — now a guided 3-étape form when the content declares
 * `steps`, per the énoncé) and Block 4 journal entries (≥ minWords). The
 * brief/prompt arrives PAM-injected in the cached bundle content. Queues offline.
 */
export function Deliverable({ eid, block, itemKey }: { eid: string; block: number; itemKey: string }) {
  const t = useT();
  const [bundle, setBundle] = useState<any>(null);
  const [text, setText] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => { const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid)); if (alive) setBundle(b); })();
    return () => { alive = false; };
  }, [eid]);

  const blk = useMemo(() => bundle?.content?.blocks?.find((x: any) => x.index === block), [bundle, block]);

  const spec = useMemo(() => {
    if (!blk) return null;
    if (itemKey === "field") {
      const fa = blk?.payload?.fieldApplication;
      return fa ? {
        kind: "field" as const, eyebrow: t("dl.fieldEyebrow"), title: fa.title || t("dl.fieldTitle"), brief: fa.brief,
        steps: (fa.steps ?? []) as StepSpec[], min: fa.minChars ?? 200, unit: "caractères", itemType: "FIELD_APPLICATION",
      } : null;
    }
    const entry = (blk?.payload?.journal?.entries ?? []).find((e: any) => `J+${e.day}` === itemKey);
    return entry ? { kind: "journal" as const, eyebrow: t("jr.eyebrow"), title: t("dl.journalTitle", { key: itemKey }), brief: entry.prompt, steps: [] as StepSpec[], min: entry.minWords ?? 50, unit: "mots", itemType: "JOURNAL_ENTRY" } : null;
  }, [blk, itemKey, t]);

  const structured = (spec?.steps?.length ?? 0) > 0;
  const count = spec?.unit === "mots" ? words(text) : text.trim().length;
  const ok = spec ? (structured
    ? spec.steps.every((s) => s.fields.every((f) => (values[f.label] ?? "").trim().length > 0))
    : count >= spec.min) : false;

  async function submit() {
    if (!ok || !spec) return;
    setBusy(true);
    try {
      const data = structured
        ? { fields: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])), text: Object.entries(values).map(([k, v]) => `${k} : ${v.trim()}`).join("\n") }
        : { text: text.trim() };
      const r = await engine.commit(eid, "complete_item", { blockIndex: block, itemType: spec.itemType, itemKey, data });
      if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
      // Chain to the next element of the parcours (never back to a blank list).
      goNext(eid, nextTarget(bundle?.content, (r as any).progress ?? getCachedProgress(eid), block, itemKey, t));
    } finally { setBusy(false); }
  }

  const Back = () => <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0 }} onClick={() => navigate(routes.cours(eid))}>{t("nav.backCourse")}</button>;
  if (!bundle) return <div className="stack"><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;
  if (!spec) return <div className="stack"><Back /><p className="banner offline">{t("dl.notFound")}</p></div>;

  return (
    <div className="stack">
      <Breadcrumb eid={eid} block={blk} itemKey={itemKey} />
      <div><div className="eyebrow">{spec.eyebrow}</div><h1 style={{ marginTop: 6 }}>{spec.title}</h1></div>

      <div className="hf-card hf-card--stripe-orange stack">
        <div className="hf-pam"><span className="tag">{t("mission")}</span><div className="quote" style={{ whiteSpace: "pre-wrap" }}>{spec.brief}</div></div>

        {structured ? (
          <>
            {spec.steps.map((s) => (
              <div key={s.title} className="stack" style={{ gap: 8 }}>
                <strong className="h4">{s.title}</strong>
                {s.intro && <p className="meta" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{s.intro}</p>}
                {s.fields.map((f) => (
                  <label key={f.label}>{f.label}
                    <input className="hf-field" value={values[f.label] ?? ""} placeholder={f.placeholder || "…"}
                      onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))}
                      onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
                  </label>
                ))}
              </div>
            ))}
          </>
        ) : (
          <div className="hf-textwrap">
            <textarea className="hf-field" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("answerPlaceholder")} style={{ minHeight: 180 }}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
            <span className="hf-count" style={{ color: ok ? "var(--brand-declick)" : undefined }}>{count} / {spec.min} {spec.unit === "mots" ? t("dl.unitWords") : t("dl.unitChars")}</span>
          </div>
        )}
        <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy || !ok} onClick={submit}>{busy ? "…" : t("dl.submit")}</button>
      </div>
    </div>
  );
}
