import { useEffect, useMemo, useState } from "react";
import { api, engine, store, getIdentity } from "../lib/app";
import { setCachedPosition, setCachedProgress, getCachedPosition } from "../lib/cache";
import { currentConn, resolveSource, type Rendition } from "../lib/media";
import { previousSession } from "../lib/content";
import { navigate, routes } from "../lib/router";
import { VideoPlayer } from "./VideoPlayer";
import { Exercise, type ExerciseMeta, type ExerciseSpec } from "./Exercise";

type Session = { id: string; title: string; video: any; exercise?: ExerciseSpec; summaryPoints?: string[]; durationEstimate?: string };
type Bundle = { content: { blocks: any[] }; mediaAssets?: { mediaId: string; renditions: Rendition[] }[] };

export function SessionScreen({ eid, block, item }: { eid: string; block: number; item: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [source, setSource] = useState<{ url: string | null; captionsUrl: string | null; quality: string | null } | null>(null);
  const [ladder, setLadder] = useState<Rendition[]>([]);
  const [startAt, setStartAt] = useState(0);
  const [phase, setPhase] = useState<"video" | "exercise">("video");
  const [error, setError] = useState<string | null>(null);

  const session: Session | null = useMemo(() => {
    const blk = bundle?.content.blocks.find((b: any) => b.index === block);
    if (!blk) return null;
    const m = (blk.payload?.microSessions ?? []).find((s: any) => s.id === item);
    if (m) return m;
    if (blk.type === "ONBOARDING" && (item === "declencheur" || item === "trigger")) return { id: item, title: "Vidéo déclencheur", video: blk.payload.triggerVideo };
    return null;
  }, [bundle, block, item]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<Bundle>(eid)) ?? (await engine.cacheBundle(eid));
      if (!alive) return;
      if (!b) { setError("Parcours indisponible hors-ligne."); return; }
      setBundle(b);
    })();
    return () => { alive = false; };
  }, [eid]);

  useEffect(() => {
    if (!bundle || !session) return;
    let alive = true;
    (async () => {
      // Resume offset: cached first (offline-safe), then the server's saved value.
      const cached = getCachedPosition(eid, block, item);
      let at = cached?.positionSec ?? 0;
      try {
        const p = await api.get<{ positionSec: number }>(`/enrollments/${eid}/position?blockIndex=${block}&itemKey=${encodeURIComponent(item)}`);
        if (p?.positionSec) at = Math.max(at, p.positionSec);
      } catch { /* offline */ }

      // Adaptive source: online manifest → offline ladder → raw url.
      let manifest = null;
      if (navigator.onLine && session.video?.mediaId) { try { manifest = await api.mediaPlayback(session.video.mediaId); } catch { /* fall back */ } }
      const offline = bundle.mediaAssets?.find((a) => a.mediaId === session.video?.mediaId)?.renditions ?? null;
      if (!alive) return;
      setStartAt(at);
      setLadder(manifest?.renditions?.length ? manifest.renditions : (offline ?? []));
      setSource(resolveSource(session.video ?? {}, manifest, offline, currentConn()));
    })();
    return () => { alive = false; };
  }, [bundle, session, eid, block, item]);

  function heartbeat(sec: number, durationSec: number | null) {
    const positionSec = Math.round(sec);
    const dur = durationSec ? Math.round(durationSec) : (session?.video?.durationSec ?? null);
    setCachedPosition(eid, block, item, { positionSec, durationSec: dur });
    void engine.record(eid, "position", { blockIndex: block, itemKey: item, positionSec, durationSec: dur ?? undefined });
  }

  async function completeSession(data: unknown, meta?: ExerciseMeta) {
    const r = await engine.commit(eid, "complete_item", { blockIndex: block, itemType: "MICRO_SESSION", itemKey: item, data, meta });
    if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
    navigate(routes.course(eid));
  }

  if (error) return <div><button className="ghost" onClick={() => navigate(routes.course(eid))}>← Retour</button><p className="banner offline">{error}</p></div>;
  if (!bundle || !session || !source) return <div><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" style={{ height: 200 }} /></div>;

  return (
    <div className="stack">
      <button className="ghost" onClick={() => navigate(routes.course(eid))}>← {session.title}</button>

      {session.durationEstimate && (
        <div className="meta" style={{ marginTop: -4 }}>⏱️ Cette micro-session : {session.durationEstimate}</div>
      )}

      {phase === "video" && (
        <>
          {(() => {
            const prev = previousSession(bundle.content.blocks, block, item);
            return prev && prev.summaryPoints.length > 0 ? (
              <div className="card" style={{ background: "#eff6ff" }}>
                <strong>↩︎ Rappel — {prev.title}</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>{prev.summaryPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
            ) : null;
          })()}
          <VideoPlayer
            src={source.url} captionsUrl={source.captionsUrl} title={session.title} renditions={ladder}
            startAt={startAt} durationSec={session.video?.durationSec} quality={source.quality}
            watermark={(() => { const me = getIdentity(); return me ? `${me.name} · ${me.email}` : null; })()}
            onHeartbeat={heartbeat}
            onEnded={() => { if (session.exercise) setPhase("exercise"); else void completeSession({ watched: true }); }}
          />
          {session.video?.keyMessage && <div className="hf-card hf-card--icy"><div className="eyebrow">À retenir</div><p className="body" style={{ margin: "6px 0 0" }}>{session.video.keyMessage}</p></div>}
          {!source.url && (
            <div className="hf-card hf-card--icy"><p className="body" style={{ margin: 0 }}>⚠️ La vidéo n'est pas disponible pour le moment. Vous pouvez tout de même poursuivre la micro-session.</p></div>
          )}
          {/* Always offer a way forward so a missing/failing video never blocks progression. */}
          {session.exercise
            ? <button className="hf-btn hf-btn--outline hf-btn--block" onClick={() => setPhase("exercise")}>Passer à l'exercice →</button>
            : <button className="hf-btn hf-btn--outline hf-btn--block" onClick={() => void completeSession({ watched: true })}>Terminer la micro-session →</button>}
        </>
      )}

      {phase === "exercise" && session.exercise && (
        <Exercise exercise={session.exercise} onComplete={(data, meta) => completeSession(data, meta)} />
      )}
    </div>
  );
}
