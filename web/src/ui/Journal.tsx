import { useEffect, useMemo, useState } from "react";
import { api, engine, store } from "../lib/app";
import { getCachedProgress, type ProgressSnapshot } from "../lib/cache";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

/** Journal de bord (Bloc 4) — les micro-entrées J+1 → J+14, prompts ancrés PAM. */
export function Journal({ eid }: { eid: string }) {
  const t = useT();
  const [bundle, setBundle] = useState<any>(null);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(() => getCachedProgress(eid));

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      if (alive) setBundle(b);
      try { const d = await api.progress(eid); if (alive && d?.progress) setProgress(d.progress); } catch { /* */ }
    })();
    return () => { alive = false; };
  }, [eid]);

  const cert = useMemo(() => bundle?.content?.blocks?.find((b: any) => b.type === "CERTIFICATION"), [bundle]);
  const entries: any[] = cert?.payload?.journal?.entries ?? [];
  const done = new Set(progress?.blocks?.find((b: any) => b.index === cert?.index)?.completedKeys ?? []);
  const blockIndex = cert?.index ?? 4;

  if (!bundle) return <div className="stack"><div className="skeleton line" style={{ width: "40%" }} /><div className="skeleton card" /></div>;

  return (
    <div className="stack">
      <div><div className="eyebrow">{t("jr.eyebrow")}</div><h1 style={{ marginTop: 6 }}>{t("jr.title")}</h1></div>
      <p className="body">{t("jr.intro")}</p>
      {entries.map((e) => {
        const key = `J+${e.day}`; const isDone = done.has(key);
        return (
          <div key={key} className="hf-card hf-card--tight hf-rowtap row between" onClick={() => navigate(routes.deliverable(eid, blockIndex, key))}>
            <div className="row" style={{ gap: 12 }}>
              <span className={`hf-medal ${isDone ? "earned" : ""}`} style={{ width: 44, height: 44, fontSize: 12 }}>J+{e.day}</span>
              <div>
                <strong className="h4">{t("jr.day", { n: e.day })}</strong>
                <div className="meta" style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.prompt}</div>
              </div>
            </div>
            {isDone ? <span className="hf-pill hf-pill--mint hf-pill--sm">✓</span> : <span className="meta">→</span>}
          </div>
        );
      })}
    </div>
  );
}
