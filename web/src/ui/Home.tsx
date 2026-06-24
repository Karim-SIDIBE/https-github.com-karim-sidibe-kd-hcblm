import { useCallback, useEffect, useState } from "react";
import type { CourseContent } from "@kd/shared";
import { api, engine, store, getIdentity } from "../lib/app";
import { rememberEnrollment } from "../lib/autosync";
import { getCachedProgress, getCachedResume, setCachedProgress, setCachedResume, type ProgressSnapshot, type ResumeSnapshot } from "../lib/cache";
import { blockItems } from "../lib/content";
import { remainingLabel, type Session } from "../lib/format";
import { navigate, routes } from "../lib/router";

const LEVELS: Record<string, string> = { L1: "Niveau 1", L2: "Niveau 2", L3: "Niveau 3", N1: "Niveau 1", N2: "Niveau 2", N3: "Niveau 3" };
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
type Bundle = { course: { title: string; level: string }; content: CourseContent };

export function Home({ eid }: { eid: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(() => getCachedProgress(eid));
  const [resume, setResume] = useState<ResumeSnapshot>(() => getCachedResume(eid));
  const [name, setName] = useState(() => getIdentity()?.name?.trim().split(" ")[0] ?? "");
  const [peer, setPeer] = useState<{ name: string; notified: boolean } | null>(null);
  const [weakAreas, setWeakAreas] = useState<{ subArea: string; pct: number }[]>([]);

  const refresh = useCallback(async () => {
    try {
      const d = await api.progress(eid);
      if (d?.progress) { setProgress(d.progress); setCachedProgress(eid, d.progress); }
      if (d?.learnerName) setName(String(d.learnerName).split(" ")[0]!);
      setPeer(d?.peer ?? null);
      const r = await api.resume(eid);
      setResume(r?.resume ?? null); setCachedResume(eid, r?.resume ?? null);
      // Diagnostic weak areas (server-backed → cross-device remediation focus).
      const dg = await api.get<{ taken?: boolean; weaknesses?: { subArea: string; pct: number }[] }>(`/enrollments/${eid}/diagnostic`);
      if (dg?.taken && dg.weaknesses) setWeakAreas(dg.weaknesses);
    } catch { /* offline — cached */ }
  }, [eid]);

  useEffect(() => {
    let alive = true; rememberEnrollment(eid);
    (async () => {
      const cached = await store.getBundle<Bundle>(eid); if (alive && cached) setBundle(cached);
      const b = await engine.cacheBundle(eid); if (alive && b) setBundle(b);
      await refresh();
    })();
    return () => { alive = false; };
  }, [eid, refresh]);

  if (!bundle) return <div className="stack"><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /><div className="skeleton card" /></div>;

  const blocks = bundle.content.blocks;
  const doneIdx = new Set(progress?.completedBlockIndexes ?? []);
  const stateOf = (i: number) => progress?.blocks.find((b) => b.index === i)?.state ?? (i === 0 ? "available" : "locked");
  const blocksDone = doneIdx.size;
  const pct = Math.round((blocksDone / blocks.length) * 100);
  const prod = progress?.productivity;

  const allSessions: Session[] = blocks.flatMap((b) => {
    const done = new Set(progress?.blocks.find((x) => x.index === b.index)?.completedKeys ?? []);
    return blockItems(b as any).filter((it) => it.kind === "session").map((it) => ({ key: it.key, durationSec: it.durationSec ?? 0, done: done.has(it.key) }));
  });
  const remaining = remainingLabel(allSessions);

  const openResume = () => { if (!resume) return; resume.blockIndex === 0 ? navigate(routes.onboarding(eid)) : navigate(routes.session(eid, resume.blockIndex, resume.itemKey)); };

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{bundle.course.title} · {LEVELS[bundle.course.level] ?? bundle.course.level}</div>
        <h1 style={{ marginTop: 6 }}>Bonjour {name || "👋"}</h1>
      </div>

      {resume && !progress?.courseCompleted && (
        <div className="hf-card hf-card--peach hf-card--stripe-orange">
          <div className="eyebrow">Reprendre</div>
          <div className="h3" style={{ margin: "6px 0 2px" }}>Bloc {resume.blockIndex}{(resume as any).itemLabel ? ` · ${(resume as any).itemLabel}` : ""}{(resume as any).blockTitle ? ` — ${(resume as any).blockTitle}` : ""}</div>
          <div className="meta">↺ Reprise exacte{resume.positionSec ? ` · vidéo ${mmss(resume.positionSec)}` : ""}</div>
          <button className="hf-btn hf-btn--primary hf-btn--block" style={{ marginTop: 14 }} onClick={openResume}>Reprendre →</button>
        </div>
      )}
      {progress?.courseCompleted && <div className="hf-card hf-card--mint"><span className="hf-pill hf-pill--mint">Parcours terminé 🎓</span></div>}

      {/* Targeted remediation: keep the diagnostic's weak areas in focus (Pilier 3).
          Server-backed (cross-device) with a local cache fallback for offline. */}
      {!progress?.courseCompleted && (() => {
        let prio: Array<{ subArea?: string; label?: string }> = weakAreas;
        if (!prio.length) { try { prio = JSON.parse(localStorage.getItem(`klms_diag_${eid}`) || "null")?.priorities ?? []; } catch { /* no diagnostic yet */ } }
        if (!prio.length) return null;
        return (
          <div className="hf-card hf-card--icy">
            <div className="eyebrow">🎯 Vos axes prioritaires</div>
            <p className="body" style={{ margin: "6px 0 0" }}>D'après votre diagnostic, concentrez-vous sur :</p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {prio.slice(0, 2).map((p, i) => <li key={i} className="body" style={{ color: "var(--fg-1)" }}><strong>{p?.subArea ?? p?.label ?? String(p)}</strong></li>)}
            </ul>
            <button className="hf-btn hf-btn--primary hf-btn--block" style={{ marginTop: 12 }} onClick={() => navigate(routes.revision(eid))}>Réviser mes points faibles →</button>
            <button className="hf-btn hf-btn--ghost hf-btn--block" style={{ marginTop: 6 }} onClick={() => navigate(routes.cours(eid))}>Aller au cours</button>
          </div>
        );
      })()}

      <div className="hf-card">
        <div className="row between"><strong className="h3" style={{ margin: 0 }}>Progression</strong><span className="num accent" style={{ fontSize: 26 }}>{pct}%</span></div>
        <div className="hf-prog" style={{ margin: "12px 0" }}><i style={{ width: `${pct}%` }} /></div>
        <div className="row between meta"><span>{blocksDone} / {blocks.length} blocs</span>{remaining && <span>⏱️ {remaining}</span>}</div>
      </div>

      {prod && (
        <div className="hf-card hf-card--peach">
          <div className="row between">
            <div><div className="eyebrow">Score de productivité</div><div className="meta" style={{ marginTop: 2 }}>Monte à chaque exercice complété</div></div>
            <span className="num accent" style={{ fontSize: 30 }}>{prod.score}<span style={{ fontSize: 15 }}>/100</span></span>
          </div>
          <div className="hf-prog" style={{ margin: "12px 0 0" }}><i style={{ width: `${prod.score}%` }} /></div>
        </div>
      )}

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Votre parcours</div>
        <div className="hf-rail">
          {blocks.map((b, i) => {
            const st = stateOf(b.index); const done = doneIdx.has(b.index);
            const cls = done ? "done" : st !== "locked" ? "now" : "";
            return (
              <span key={b.index} style={{ display: "contents" }}>
                {i > 0 && <span className={`seg ${doneIdx.has(b.index - 1) ? "done" : ""}`} />}
                <span className={`node ${cls}`} title={b.title}>{done ? "✓" : st === "locked" ? "🔒" : b.index}</span>
              </span>
            );
          })}
        </div>
      </div>

      {peer && (
        <div className="hf-card hf-card--mint row between">
          <div className="row" style={{ gap: 10 }}>
            <span className="hf-medal earned" style={{ width: 40, height: 40, fontSize: 16 }}>👥</span>
            <div><div className="meta">Pair de progression</div><strong className="h4">{peer.name}</strong></div>
          </div>
          {peer.notified && <span className="hf-pill hf-pill--mint hf-pill--sm">✓ Notifié</span>}
        </div>
      )}
    </div>
  );
}
