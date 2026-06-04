import { useCallback, useEffect, useState } from "react";
import { api, engine, store } from "../lib/app";
import { rememberEnrollment } from "../lib/autosync";
import { getCachedProgress, setCachedProgress, type ProgressSnapshot } from "../lib/cache";
import { formatDuration } from "../lib/format";
import { blockItems, ITEM_TYPE, type BlockItem, type ItemKind } from "../lib/content";
import { blockMediaUrls, downloadBlock, isBlockDownloaded } from "../lib/offline";
import { navigate, routes } from "../lib/router";
import type { CourseContent } from "@kd/shared";

type Bundle = { course: { title: string }; content: CourseContent };

const STATE = (st: string) =>
  st === "completed" ? <span className="hf-pill hf-pill--mint hf-pill--sm">Terminé</span> :
  st === "locked" ? <span className="hf-lock">🔒 Verrouillé</span> :
  <span className="hf-pill hf-pill--orange hf-pill--sm">En cours</span>;
const ICON: Record<ItemKind, string> = {
  onboarding: "🚀", diagnostic: "📝", session: "🎬", case: "📋", scenarios: "🧩",
  interblock: "📝", field: "📍", self: "🪞", plan: "🗓️", final: "🏁", journal: "📓", project: "🎓",
};
const NAVIGABLE: ItemKind[] = ["onboarding", "session", "diagnostic", "interblock", "final", "field", "journal", "project"];

export function Course({ eid }: { eid: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(() => getCachedProgress(eid));
  const [diag, setDiag] = useState<{ priorities: string[]; profile: string | null } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dl, setDl] = useState<Record<number, "idle" | "busy" | "done">>({});

  async function download(blockIndex: number) {
    if (!bundle) return;
    setDl((d) => ({ ...d, [blockIndex]: "busy" }));
    const r = await downloadBlock(api.cacheFetch, bundle as any, eid, blockIndex);
    setDl((d) => ({ ...d, [blockIndex]: "done" }));
    setMsg(`Bloc ${blockIndex} téléchargé pour le hors-ligne (${r.cached} fichier·s).`);
  }

  const refreshProgress = useCallback(async () => {
    try { const data = await api.progress(eid); if (data?.progress) { setProgress(data.progress); setCachedProgress(eid, data.progress); } } catch { /* offline */ }
  }, [eid]);

  useEffect(() => {
    let alive = true; rememberEnrollment(eid);
    try { const d = localStorage.getItem(`klms_diag_${eid}`); if (d) setDiag(JSON.parse(d)); } catch { /* */ }
    (async () => {
      const cached = await store.getBundle<Bundle>(eid); if (alive && cached) setBundle(cached);
      const b = await engine.cacheBundle(eid);
      if (alive && b) setBundle(b); else if (alive && !cached) setMsg("Parcours indisponible (hors-ligne et non téléchargé).");
      await refreshProgress();
    })();
    return () => { alive = false; };
  }, [eid, refreshProgress]);

  const stateOf = (i: number) => progress?.blocks.find((b) => b.index === i)?.state ?? (i === 0 ? "available" : "locked");
  const doneKeys = (i: number) => new Set(progress?.blocks.find((b) => b.index === i)?.completedKeys ?? []);

  function onItem(blockIndex: number, it: BlockItem) {
    if (it.kind === "onboarding") return navigate(routes.onboarding(eid));
    if (it.kind === "session") return navigate(routes.session(eid, blockIndex, it.key));
    if (it.kind === "diagnostic" || it.kind === "interblock" || it.kind === "final") return navigate(routes.quiz(eid, it.kind));
    if (it.kind === "field" || it.kind === "journal") return navigate(routes.deliverable(eid, blockIndex, it.key));
    if (it.kind === "project") return navigate(routes.project(eid));
  }
  async function completeInterim(blockIndex: number, it: BlockItem) {
    const r = await engine.commit(eid, "complete_item", { blockIndex, itemType: ITEM_TYPE[it.kind] ?? "MICRO_SESSION", itemKey: it.key });
    if ((r as any).progress) { setProgress((r as any).progress); setCachedProgress(eid, (r as any).progress); } else await refreshProgress();
  }

  if (!bundle) return <div className="stack">{msg ? <p className="banner offline">{msg}</p> : <><div className="skeleton line" style={{ width: "55%" }} /><div className="skeleton card" /><div className="skeleton card" /></>}</div>;

  const blocks = bundle.content.blocks;

  return (
    <div className="stack">
      <div><div className="eyebrow">Le parcours</div><h1 style={{ marginTop: 6 }}>{bundle.course.title}</h1></div>
      {msg && <p className="meta">{msg}</p>}

      {diag && (diag.priorities?.length ?? 0) > 0 && (
        <div className="hf-card hf-card--peach hf-card--stripe-orange">
          <div className="eyebrow">🎯 Vos priorités d'apprentissage</div>
          {diag.profile && <span className="hf-pill hf-pill--orange hf-pill--sm" style={{ margin: "8px 0", display: "inline-flex" }}>{diag.profile}</span>}
          <ol style={{ margin: "6px 0 0", paddingLeft: 20 }} className="body">{diag.priorities.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      )}

      {blocks.map((b) => {
        const st = stateOf(b.index); const done = doneKeys(b.index); const locked = st === "locked"; const items = blockItems(b);
        return (
          <section key={b.index} className="hf-card" style={locked ? { opacity: 0.62 } : undefined}>
            <div className="row between"><h3 style={{ margin: 0 }}>{b.index}. {b.title}</h3>{STATE(st)}</div>
            {!locked && blockMediaUrls(bundle as any, b.index).length > 0 && (
              (dl[b.index] === "done" || isBlockDownloaded(eid, b.index))
                ? <span className="hf-pill hf-pill--mint hf-pill--sm" style={{ marginTop: 10 }}>⬇ Disponible hors-ligne</span>
                : <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ marginTop: 6, paddingLeft: 0 }} disabled={dl[b.index] === "busy"} onClick={() => download(b.index)}>
                    {dl[b.index] === "busy" ? "Téléchargement…" : "⬇ Télécharger les vidéos"}
                  </button>
            )}
            <div className="stack" style={{ marginTop: 12 }}>
              {items.map((it) => {
                const isDone = done.has(it.key) || (it.kind === "onboarding" && st === "completed");
                return (
                  <div key={it.key} className="hf-rowtap row between" style={{ padding: "11px 13px", border: "1px solid var(--line)", borderRadius: "var(--r-md)", cursor: locked ? "default" : "pointer" }}
                    onClick={() => { if (!locked) onItem(b.index, it); }}>
                    <span className="row" style={{ gap: 11 }}>
                      <span style={{ fontSize: 18 }}>{isDone ? "✅" : ICON[it.kind]}</span>
                      <span><strong className="h4" style={{ fontWeight: 600 }}>{it.label}</strong>{it.durationSec ? <div className="meta">{formatDuration(it.durationSec)}</div> : null}</span>
                    </span>
                    {!locked && !isDone && !NAVIGABLE.includes(it.kind)
                      ? <button className="hf-btn hf-btn--sm hf-btn--outline" onClick={(e) => { e.stopPropagation(); completeInterim(b.index, it); }}>Terminé</button>
                      : <span className="meta">{isDone ? "" : "→"}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
