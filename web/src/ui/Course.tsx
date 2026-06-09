import { useCallback, useEffect, useState } from "react";
import { api, engine, store } from "../lib/app";
import { rememberEnrollment } from "../lib/autosync";
import { getCachedProgress, setCachedProgress, type ProgressSnapshot } from "../lib/cache";
import { formatDuration } from "../lib/format";
import { blockItems, ITEM_TYPE, type BlockItem, type ItemKind } from "../lib/content";
import { availabilityOf, makeAvailable, removeAvailability, purgeExpired, purgeCompleted, type Availability } from "../lib/offline";
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

const akey = (blockIndex: number, itemKey: string) => `${blockIndex}:${itemKey}`;

export function Course({ eid }: { eid: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(() => getCachedProgress(eid));
  const [diag, setDiag] = useState<{ priorities: string[]; profile: string | null } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [avail, setAvail] = useState<Record<string, Availability>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // Recompute every element's offline availability from the local registry.
  const refreshAvail = useCallback((b: Bundle | null) => {
    if (!b) return;
    const next: Record<string, Availability> = {};
    for (const blk of b.content.blocks) for (const it of blockItems(blk)) next[akey(blk.index, it.key)] = availabilityOf(eid, blk.index, it.key);
    setAvail(next);
  }, [eid]);

  async function makeItemAvailable(blockIndex: number, it: BlockItem) {
    if (!bundle) return;
    const k = akey(blockIndex, it.key);
    setBusy((m) => ({ ...m, [k]: true }));
    const r = await makeAvailable(api.cacheFetch, bundle as any, eid, blockIndex, it.key);
    setBusy((m) => ({ ...m, [k]: false }));
    refreshAvail(bundle);
    setMsg(r.total > 0 ? `« ${it.label} » disponible hors ligne (${r.cached}/${r.total}) · 7 jours.` : `« ${it.label} » disponible hors ligne · 7 jours.`);
  }
  async function removeItem(blockIndex: number, it: BlockItem) {
    await removeAvailability(eid, blockIndex, it.key);
    refreshAvail(bundle);
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
      const loaded = (b ?? cached) as Bundle | null;
      if (alive && b) setBundle(b); else if (alive && !cached) setMsg("Parcours indisponible (hors-ligne et non rendu disponible).");
      await purgeExpired(eid);                 // evict elements past their 7-day window
      if (alive) refreshAvail(loaded);
      await refreshProgress();
    })();
    return () => { alive = false; };
  }, [eid, refreshProgress, refreshAvail]);

  // When progress changes, purge offline copies of any element now completed
  // (online → immediately; offline → as soon as the completion syncs).
  useEffect(() => {
    if (!progress || !bundle) return;
    const completedByBlock: Record<number, string[]> = {};
    for (const b of progress.blocks) {
      completedByBlock[b.index] = [...(b.completedKeys ?? [])];
      const blk = bundle.content.blocks.find((x) => x.index === b.index);
      if (b.state === "completed" && blk?.type === "ONBOARDING") completedByBlock[b.index]!.push("onboarding");
    }
    (async () => { const n = await purgeCompleted(eid, completedByBlock); if (n > 0) refreshAvail(bundle); })();
  }, [progress, bundle, eid, refreshAvail]);

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
            {Array.isArray((b as any).units) && (b as any).units.length > 0 && (() => {
              const c = { ms: 0, la: 0, mt: 0 };
              for (const u of (b as any).units) { if (u.type === "micro-session") c.ms++; else if (u.type === "long-activity") c.la++; else if (u.type === "micro-task") c.mt++; }
              const parts = [`${c.ms} micro-session${c.ms > 1 ? "s" : ""}`];
              if (c.la) parts.push(`${c.la} activité${c.la > 1 ? "s" : ""} longue${c.la > 1 ? "s" : ""}`);
              if (c.mt) parts.push(`${c.mt} micro-tâche${c.mt > 1 ? "s" : ""}`);
              return <div className="meta" style={{ marginTop: 4 }}>{parts.join(" · ")}</div>;
            })()}
            <div className="stack" style={{ marginTop: 12 }}>
              {items.map((it) => {
                const isDone = done.has(it.key) || (it.kind === "onboarding" && st === "completed");
                const k = akey(b.index, it.key);
                const av = avail[k];
                return (
                  <div key={it.key}>
                    <div className="hf-rowtap row between" style={{ padding: "11px 13px", border: "1px solid var(--line)", borderRadius: "var(--r-md)", cursor: locked ? "default" : "pointer" }}
                      onClick={() => { if (!locked) onItem(b.index, it); }}>
                      <span className="row" style={{ gap: 11 }}>
                        <span style={{ fontSize: 18 }}>{isDone ? "✅" : ICON[it.kind]}</span>
                        <span><strong className="h4" style={{ fontWeight: 600 }}>{it.label}</strong>{it.durationSec ? <div className="meta">{formatDuration(it.durationSec)}</div> : null}</span>
                      </span>
                      {!locked && !isDone && !NAVIGABLE.includes(it.kind)
                        ? <button className="hf-btn hf-btn--sm hf-btn--outline" onClick={(e) => { e.stopPropagation(); completeInterim(b.index, it); }}>Terminé</button>
                        : <span className="meta">{isDone ? "" : "→"}</span>}
                    </div>
                    {!locked && !isDone && (
                      <div className="row" style={{ gap: 8, marginTop: 6, paddingLeft: 2 }}>
                        {av?.available
                          ? <>
                              <span className="hf-pill hf-pill--mint hf-pill--sm">✓ Disponible hors ligne · {av.daysLeft} j</span>
                              <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ padding: "2px 8px" }} onClick={(e) => { e.stopPropagation(); removeItem(b.index, it); }}>Retirer</button>
                            </>
                          : <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ padding: "2px 8px" }} disabled={busy[k]} onClick={(e) => { e.stopPropagation(); makeItemAvailable(b.index, it); }}>
                              {busy[k] ? "…" : "⤓ Rendre disponible hors ligne"}
                            </button>}
                      </div>
                    )}
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
