import { useCallback, useEffect, useState } from "react";
import { api, engine, store } from "../lib/app";
import { rememberEnrollment } from "../lib/autosync";
import { getCachedProgress, getCachedResume, setCachedProgress, setCachedResume, type ProgressSnapshot, type ResumeSnapshot } from "../lib/cache";
import { formatDuration, remainingLabel, type Session } from "../lib/format";
import { blockItems, ITEM_TYPE, type BlockItem, type ItemKind } from "../lib/content";
import { blockMediaUrls, downloadBlock, isBlockDownloaded } from "../lib/offline";
import { navigate, routes } from "../lib/router";
import type { CourseContent } from "@kd/shared";

type Bundle = { course: { title: string }; content: CourseContent };

const STATE_CHIP: Record<string, { label: string; cls: string }> = {
  locked: { label: "Verrouillé", cls: "" },
  available: { label: "En cours", cls: "warn" },
  completed: { label: "Terminé", cls: "ok" },
};
const ICON: Record<ItemKind, string> = {
  onboarding: "🚀", diagnostic: "📝", session: "🎬", case: "📋", scenarios: "🧩",
  interblock: "📝", field: "📍", self: "🪞", plan: "🗓️", final: "🏁", journal: "📓", project: "🎓",
};
const NAVIGABLE: ItemKind[] = ["onboarding", "session", "diagnostic", "interblock", "final", "field", "journal", "project"];

export function Course({ eid }: { eid: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(() => getCachedProgress(eid));
  const [resume, setResume] = useState<ResumeSnapshot>(() => getCachedResume(eid));
  const [diag, setDiag] = useState<{ priorities: string[]; profile: string | null } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dl, setDl] = useState<Record<number, "idle" | "busy" | "done">>({});

  async function download(blockIndex: number) {
    if (!bundle) return;
    setDl((d) => ({ ...d, [blockIndex]: "busy" }));
    const r = await downloadBlock(api.cacheFetch, bundle as any, eid, blockIndex);
    setDl((d) => ({ ...d, [blockIndex]: "done" }));
    setMsg(`Bloc ${blockIndex} téléchargé pour le mode hors-ligne (${r.cached} fichier(s)).`);
  }

  const refreshProgress = useCallback(async () => {
    try {
      const data = await api.progress(eid);
      if (data?.progress) { setProgress(data.progress); setCachedProgress(eid, data.progress); }
      const r = await api.resume(eid);
      setResume(r?.resume ?? null); setCachedResume(eid, r?.resume ?? null);
    } catch { /* offline — keep cached snapshots */ }
  }, [eid]);

  useEffect(() => {
    let alive = true;
    rememberEnrollment(eid);
    try { const d = localStorage.getItem(`klms_diag_${eid}`); if (d) setDiag(JSON.parse(d)); } catch { /* */ }
    (async () => {
      const cached = await store.getBundle<Bundle>(eid);
      if (alive && cached) setBundle(cached);
      const b = await engine.cacheBundle(eid);
      if (alive && b) setBundle(b);
      else if (alive && !cached) setMsg("Parcours indisponible (hors-ligne et non téléchargé).");
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

  // Interim completion for item types whose dedicated UI lands in Phase 5.
  async function completeInterim(blockIndex: number, it: BlockItem) {
    const r = await engine.commit(eid, "complete_item", { blockIndex, itemType: ITEM_TYPE[it.kind] ?? "MICRO_SESSION", itemKey: it.key });
    if ((r as any).progress) { setProgress((r as any).progress); setCachedProgress(eid, (r as any).progress); }
    else await refreshProgress();
  }

  if (!bundle) {
    return (
      <div>
        <button className="ghost" onClick={() => navigate(routes.enrollments())}>← Mes parcours</button>
        {msg ? <p className="banner offline">{msg}</p> : <><div className="skeleton line" style={{ width: "55%" }} /><div className="skeleton card" /><div className="skeleton card" /></>}
      </div>
    );
  }

  const blocks = bundle.content.blocks;
  const allSessions: Session[] = blocks.flatMap((b) => {
    const done = doneKeys(b.index);
    return blockItems(b).filter((it) => it.kind === "session").map((it) => ({ key: it.key, durationSec: it.durationSec ?? 0, done: done.has(it.key) }));
  });
  const blocksDone = progress?.completedBlockIndexes.length ?? 0;
  const pct = Math.round((blocksDone / blocks.length) * 100);
  const remaining = remainingLabel(allSessions);

  return (
    <div>
      <button className="ghost" onClick={() => navigate(routes.enrollments())}>← Mes parcours</button>
      <h1>{bundle.course.title}</h1>
      {msg && <p className="muted">{msg}</p>}

      <div className="card">
        <div className="row between"><strong>Progression</strong><span className="muted">{blocksDone}/{blocks.length} blocs · {pct}%</span></div>
        <div className="progress" style={{ margin: "10px 0" }}><span style={{ width: `${pct}%` }} /></div>
        {remaining && <p className="muted" style={{ margin: 0 }}>⏱️ {remaining}</p>}
        {resume && !progress?.courseCompleted && (
          <button className="block" style={{ marginTop: 12 }} onClick={() => onItem(resume.blockIndex, { key: resume.itemKey, kind: resume.blockIndex === 0 ? "onboarding" : "session", label: "" })}>
            ▶ Reprendre — bloc {resume.blockIndex}{resume.positionSec ? ` (à ${formatDuration(resume.positionSec)})` : ""}
          </button>
        )}
        {progress?.courseCompleted && <p className="chip ok" style={{ marginTop: 10 }}>Parcours terminé 🎓</p>}
        <button className="secondary block" style={{ marginTop: 10 }} onClick={() => navigate(routes.badges(eid))}>🏅 Mes badges & certificat</button>
      </div>

      {diag && (diag.priorities?.length ?? 0) > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--brand)" }}>
          <strong>🎯 Vos priorités d'apprentissage</strong>
          {diag.profile && <p className="chip ok" style={{ margin: "8px 0", display: "inline-block" }}>{diag.profile}</p>}
          <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>{diag.priorities.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      )}

      {blocks.map((b) => {
        const st = stateOf(b.index);
        const chip = STATE_CHIP[st] ?? { label: "—", cls: "" };
        const done = doneKeys(b.index);
        const locked = st === "locked";
        const items = blockItems(b);
        return (
          <section key={b.index} className="card" style={locked ? { opacity: 0.6 } : undefined}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>{b.index}. {b.title}</h2>
              <span className={`chip ${chip.cls}`}>{locked ? "🔒 " : ""}{chip.label}</span>
            </div>
            {!locked && blockMediaUrls(bundle as any, b.index).length > 0 && (
              (dl[b.index] === "done" || isBlockDownloaded(eid, b.index))
                ? <span className="chip ok" style={{ marginTop: 8 }}>⬇ Disponible hors-ligne</span>
                : <button className="ghost" style={{ marginTop: 4 }} disabled={dl[b.index] === "busy"} onClick={() => download(b.index)}>
                    {dl[b.index] === "busy" ? "Téléchargement…" : "⬇ Télécharger les vidéos (hors-ligne)"}
                  </button>
            )}
            <div className="stack" style={{ marginTop: 10 }}>
              {items.map((it) => {
                const isDone = done.has(it.key) || (it.kind === "onboarding" && st === "completed");
                return (
                  <div key={it.key} className="row between">
                    <button className="ghost" style={{ textAlign: "left", flex: 1 }} disabled={locked}
                      onClick={() => onItem(b.index, it)}>
                      {isDone ? "✅" : ICON[it.kind]} {it.label}
                      {it.durationSec ? <span className="muted"> · {formatDuration(it.durationSec)}</span> : null}
                    </button>
                    {!locked && !isDone && !NAVIGABLE.includes(it.kind) && (
                      <button className="secondary" onClick={() => completeInterim(b.index, it)}>Terminé</button>
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
