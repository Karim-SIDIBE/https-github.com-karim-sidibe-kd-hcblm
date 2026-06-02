import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/app";
import { engine, store } from "../lib/app";
import { rememberEnrollment } from "../lib/autosync";
import { getCachedProgress, getCachedResume, setCachedProgress, setCachedResume, type ProgressSnapshot, type ResumeSnapshot } from "../lib/cache";
import { formatDuration, remainingLabel, type Session } from "../lib/format";
import { navigate, routes } from "../lib/router";

type Micro = { id: string; title: string; video?: { durationSec?: number } };
type Block = { index: number; type: string; title: string; payload: any };
type Bundle = { course: { title: string }; content: { blocks: Block[] } };

const STATE_CHIP: Record<string, { label: string; cls: string }> = {
  locked: { label: "Verrouillé", cls: "" },
  available: { label: "En cours", cls: "warn" },
  completed: { label: "Terminé", cls: "ok" },
};

/** Micro-sessions of a block (ONBOARDING uses a single trigger video). */
function blockSessions(b: Block): Micro[] {
  if (Array.isArray(b.payload?.microSessions)) return b.payload.microSessions;
  if (b.type === "ONBOARDING" && b.payload?.triggerVideo) return [{ id: "trigger", title: "Introduction", video: b.payload.triggerVideo }];
  return [];
}

export function Course({ eid }: { eid: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(() => getCachedProgress(eid));
  const [resume, setResume] = useState<ResumeSnapshot>(() => getCachedResume(eid));
  const [msg, setMsg] = useState<string | null>(null);

  const refreshProgress = useCallback(async () => {
    try {
      const data = await api.progress(eid); // reconcile: { progress, badges, ... }
      if (data?.progress) { setProgress(data.progress); setCachedProgress(eid, data.progress); }
      const r = await api.resume(eid);
      setResume(r?.resume ?? null); setCachedResume(eid, r?.resume ?? null);
    } catch { /* offline — keep cached snapshots */ }
  }, [eid]);

  useEffect(() => {
    let alive = true;
    rememberEnrollment(eid);
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

  function openSession(blockIndex: number, itemKey: string) {
    if (blockIndex === 0) return navigate(routes.onboarding(eid));
    navigate(routes.session(eid, blockIndex, itemKey));
  }

  // Interim completion affordance (the real gate arrives with the Phase-3 player).
  async function markDone(blockIndex: number, itemKey: string) {
    const r = await engine.commit(eid, "complete_item", { blockIndex, itemType: "MICRO_SESSION", itemKey });
    if ((r as any).progress) { setProgress((r as any).progress); setCachedProgress(eid, (r as any).progress); }
    if ((r as any).resume !== undefined) { setResume((r as any).resume); setCachedResume(eid, (r as any).resume); }
    setMsg((r as any).offline ? "Enregistré hors-ligne — synchronisation à la reconnexion." : null);
    if (!(r as any).progress) await refreshProgress();
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
    return blockSessions(b).map((m) => ({ key: m.id, durationSec: m.video?.durationSec ?? 0, done: done.has(m.id) }));
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
          <button className="block" style={{ marginTop: 12 }} onClick={() => openSession(resume.blockIndex, resume.itemKey)}>
            ▶ Reprendre — bloc {resume.blockIndex}{resume.positionSec ? ` (à ${formatDuration(resume.positionSec)})` : ""}
          </button>
        )}
        {progress?.courseCompleted && <p className="chip ok" style={{ marginTop: 10 }}>Parcours terminé 🎓</p>}
      </div>

      {blocks.map((b) => {
        const st = stateOf(b.index);
        const chip = STATE_CHIP[st] ?? { label: "—", cls: "" };
        const done = doneKeys(b.index);
        const sessions = blockSessions(b);
        const locked = st === "locked";
        return (
          <section key={b.index} className="card" style={locked ? { opacity: 0.6 } : undefined}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>{b.index}. {b.title}</h2>
              <span className={`chip ${chip.cls}`}>{locked ? "🔒 " : ""}{chip.label}</span>
            </div>
            <div className="stack" style={{ marginTop: 10 }}>
              {sessions.map((m) => {
                const isDone = done.has(m.id);
                return (
                  <div key={m.id} className="row between">
                    <button className="ghost" style={{ textAlign: "left", flex: 1 }} disabled={locked}
                      onClick={() => openSession(b.index, m.id)}>
                      {isDone ? "✅" : "🎬"} {m.id} — {m.title}
                      <span className="muted"> · {formatDuration(m.video?.durationSec ?? 0)}</span>
                    </button>
                    {!locked && !isDone && b.index !== 0 && <button className="secondary" onClick={() => markDone(b.index, m.id)}>Terminé</button>}
                  </div>
                );
              })}
              {sessions.length === 0 && <p className="muted" style={{ margin: 0 }}>Contenu à venir dans une prochaine étape.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
