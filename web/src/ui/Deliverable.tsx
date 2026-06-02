import { useEffect, useMemo, useState } from "react";
import { engine, store } from "../lib/app";
import { setCachedProgress } from "../lib/cache";
import { navigate, routes } from "../lib/router";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Deliverable — PAM-context written submissions: the Block 2 field application
 * (gated, ≥ minChars) and Block 4 journal entries (≥ minWords). The brief/prompt
 * arrives PAM-injected in the cached bundle content. Queues offline.
 */
export function Deliverable({ eid, block, itemKey }: { eid: string; block: number; itemKey: string }) {
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
      return fa ? { kind: "field" as const, title: "Application terrain", brief: fa.brief, min: fa.minChars ?? 200, unit: "caractères", itemType: "FIELD_APPLICATION" } : null;
    }
    const entry = (blk?.payload?.journal?.entries ?? []).find((e: any) => `J+${e.day}` === itemKey);
    return entry ? { kind: "journal" as const, title: `Journal — Jour ${itemKey}`, brief: entry.prompt, min: entry.minWords ?? 50, unit: "mots", itemType: "JOURNAL_ENTRY" } : null;
  }, [bundle, block, itemKey]);

  const count = spec?.unit === "mots" ? words(text) : text.trim().length;
  const ok = spec ? count >= spec.min : false;

  async function submit() {
    if (!ok || !spec) return;
    setBusy(true);
    try {
      const r = await engine.commit(eid, "complete_item", { blockIndex: block, itemType: spec.itemType, itemKey, data: { text: text.trim() } });
      if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
      navigate(routes.course(eid));
    } finally { setBusy(false); }
  }

  const Back = () => <button className="ghost" onClick={() => navigate(routes.course(eid))}>← Tableau de bord</button>;
  if (!bundle) return <div><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;
  if (!spec) return <div><Back /><p className="banner offline">Élément introuvable.</p></div>;

  return (
    <div className="stack">
      <Back />
      <h1>{spec.title}</h1>
      <div className="card" style={{ background: "#eff6ff" }}><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{spec.brief}</p></div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Votre réponse, ancrée dans votre situation réelle…" style={{ minHeight: 180 }}
        onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} />
      <p className={`muted ${ok ? "ok" : ""}`} style={{ margin: 0, fontSize: 13 }}>{count} / {spec.min} {spec.unit} minimum</p>
      <button className="block" disabled={busy || !ok} onClick={submit}>{busy ? "…" : "Soumettre"}</button>
    </div>
  );
}
