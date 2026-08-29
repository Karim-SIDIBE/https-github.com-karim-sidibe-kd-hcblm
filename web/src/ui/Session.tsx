import { useEffect, useMemo, useState } from "react";
import { api, engine, store, getIdentity } from "../lib/app";
import { getCachedAiFeedback, setCachedAiFeedback, setCachedPosition, setCachedProgress, getCachedPosition, getCachedProgress } from "../lib/cache";
import { currentConn, resolveSource, type Rendition } from "../lib/media";
import { cachedUrlsOf } from "../lib/offline";
import { previousSession } from "../lib/content";
import { goNext, nextTarget } from "../lib/nav";
import { navigate, routes } from "../lib/router";
import { Breadcrumb } from "./Breadcrumb";
import { VideoPlayer } from "./VideoPlayer";
import { Exercise, type ExerciseMeta, type ExerciseSpec } from "./Exercise";
import { answerOf, useAnswers } from "../lib/answers";
import { useT } from "../lib/i18n";

type Session = { id: string; title: string; video: any; exercise?: ExerciseSpec; summaryPoints?: string[]; durationEstimate?: string };
type Bundle = { content: { blocks: any[] }; mediaAssets?: { mediaId: string; renditions: Rendition[] }[] };

export function SessionScreen({ eid, block, item }: { eid: string; block: number; item: string }) {
  const t = useT();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [source, setSource] = useState<import("../lib/media").VideoSource | null>(null);
  const [ladder, setLadder] = useState<Rendition[]>([]);
  const [startAt, setStartAt] = useState(0);
  const [phase, setPhase] = useState<"video" | "exercise" | "tquiz">("video");
  const [tqAnswers, setTqAnswers] = useState<Record<string, string>>({});
  const [tqBusy, setTqBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Frozen results: the video is always rewatchable, but a completed exercise
  // or trigger quiz shows the recorded answers read-only (no re-submission).
  const answers = useAnswers(eid);
  const doneItem = answerOf(answers, block, item);
  const doneTrigger = answerOf(answers, 0, "trigger");

  const blk = useMemo(() => bundle?.content.blocks.find((b: any) => b.index === block), [bundle, block]);
  // The Bloc 0 trigger QUIZ plays right AFTER the trigger video, inside this
  // same micro-session (design: video → quick quiz → done).
  const triggerQuiz = blk?.type === "ONBOARDING" && item === "declencheur" ? (blk.payload?.triggerQuiz ?? null) : null;
  const session: Session | null = useMemo(() => {
    if (!blk) return null;
    const m = (blk.payload?.microSessions ?? []).find((s: any) => s.id === item);
    if (m) return m;
    if (blk.type === "ONBOARDING" && (item === "declencheur" || item === "trigger")) return { id: item, title: t("sess.triggerVideo"), video: blk.payload.triggerVideo };
    return null;
  }, [bundle, block, item, t]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<Bundle>(eid)) ?? (await engine.cacheBundle(eid));
      if (!alive) return;
      if (!b) { setError(t("sess.unavailableOffline")); return; }
      setBundle(b);
    })();
    return () => { alive = false; };
  }, [eid]);

  async function submitTriggerQuiz() {
    setTqBusy(true);
    try {
      const r = await engine.commit(eid, "quiz_trigger", { answers: tqAnswers });
      if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
      await completeSession({ watched: true });
    } finally { setTqBusy(false); }
  }

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
      setSource(resolveSource(session.video ?? {}, manifest, offline, currentConn(), cachedUrlsOf(eid, block, item)));
    })();
    return () => { alive = false; };
  }, [bundle, session, eid, block, item]);

  function heartbeat(sec: number, durationSec: number | null) {
    const positionSec = Math.round(sec);
    const dur = durationSec ? Math.round(durationSec) : (session?.video?.durationSec ?? null);
    setCachedPosition(eid, block, item, { positionSec, durationSec: dur });
    void engine.record(eid, "position", { blockIndex: block, itemKey: item, positionSec, durationSec: dur ?? undefined });
  }

  async function completeSession(data: unknown, meta?: ExerciseMeta, advance = true) {
    const r = await engine.commit(eid, "complete_item", { blockIndex: block, itemType: "MICRO_SESSION", itemKey: item, data, meta });
    if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
    // Chain straight to the NEXT element of the parcours (écrans 5, 26, 30…) —
    // never back to the list, never re-opening the session just finished.
    if (advance) goToNext((r as any).progress);
  }
  function goToNext(progressAfter?: unknown) {
    const prog = (progressAfter as any) ?? getCachedProgress(eid);
    goNext(eid, nextTarget(bundle?.content as any, prog, block, item, t));
  }

  if (error) return <div><button className="ghost" onClick={() => navigate(routes.course(eid))}>← {t("common.back")}</button><p className="banner offline">{error}</p></div>;
  if (!bundle) return <div><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" style={{ height: 200 }} /></div>;
  // Bundle loaded but the item is not a micro-session (bad/stale link): say so
  // instead of showing a skeleton forever.
  if (!session) return <div className="stack"><button className="ghost" onClick={() => navigate(routes.cours(eid))}>← {t("common.back")}</button><p className="banner offline">{t("dl.notFound")}</p></div>;
  if (!source) return <div><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" style={{ height: 200 }} /></div>;

  return (
    <div className="stack">
      {/* Écrans 7–8 : la flèche retour dit « Cours », puis Bloc + micro-session. */}
      <Breadcrumb eid={eid} block={blk} itemKey={item} />

      {phase === "video" && (
        <>
          {(() => {
            const prev = previousSession(bundle.content.blocks, block, item);
            return prev && prev.summaryPoints.length > 0 ? (
              <div className="card" style={{ background: "#eff6ff" }}>
                <strong>{t("sess.recall", { title: prev.title })}</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>{prev.summaryPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
            ) : null;
          })()}
          <VideoPlayer
            src={source.url} captionsUrl={source.captionsUrl} captionTracks={source.captionTracks} title={session.title} renditions={ladder}
            startAt={startAt} durationSec={session.video?.durationSec} quality={source.quality}
            watermark={(() => { const me = getIdentity(); return me ? `${me.name} · ${me.email}` : null; })()}
            onHeartbeat={heartbeat}
            onEnded={() => { if (session.exercise) setPhase("exercise"); else if (triggerQuiz) setPhase("tquiz"); else void completeSession({ watched: true }); }}
          />
          {source.url && <p className="meta" style={{ marginTop: -4 }}>{t("sess.fullscreenHint")}</p>}
          {session.video?.keyMessage && <div className="hf-card hf-card--icy"><div className="eyebrow">{t("sess.keyTakeaway")}</div><p className="body" style={{ margin: "6px 0 0" }}>{session.video.keyMessage}</p></div>}
          {!source.url && (
            <div className="hf-card hf-card--icy"><p className="body" style={{ margin: 0 }}>{t("sess.videoUnavailable")}</p></div>
          )}
          {/* Always offer a way forward so a missing/failing video never blocks progression. */}
          {session.exercise
            ? <button className="hf-btn hf-btn--outline hf-btn--block" onClick={() => setPhase("exercise")}>{doneItem ? t("frz.viewAnswer") : t("sess.skipExercise")}</button>
            : triggerQuiz
              ? <button className="hf-btn hf-btn--outline hf-btn--block" onClick={() => setPhase("tquiz")}>{doneTrigger ? t("frz.viewAnswer") : t("sess.toTriggerQuiz")}</button>
              : <button className="hf-btn hf-btn--outline hf-btn--block" onClick={() => void completeSession({ watched: true })}>{t("sess.finishSession")}</button>}
        </>
      )}

      {phase === "exercise" && session.exercise && (
        <Exercise exercise={session.exercise} frozen={doneItem?.data} draftKey={`ex:${eid}:${block}:${item}`} onComplete={(data, meta) => completeSession(data, meta, false)} onNext={() => goToNext()}
          aiFeedback={session.exercise.type === "multi" ? undefined : async () => {
            // Personalised formative feedback on the saved answer. The server
            // keeps the FIRST generated feedback (idempotent) — revisits of a
            // frozen exercise re-show it; the local cache covers offline.
            const cached = getCachedAiFeedback(eid, block, item);
            if (cached) return cached;
            if (!navigator.onLine) return null;
            const r = await api.post<{ feedback?: string }>(`/enrollments/${eid}/feedback`, { blockIndex: block, itemKey: item });
            if (r?.feedback) setCachedAiFeedback(eid, block, item, r.feedback);
            return r?.feedback ?? null;
          }} />
      )}

      {phase === "tquiz" && triggerQuiz && (() => {
        // Already answered → read-only recap of the recorded choices.
        const rec = (doneTrigger?.data as { answers?: Record<string, string> } | undefined)?.answers;
        const shown = rec ?? tqAnswers;
        const frozenTq = Boolean(rec);
        return (
          <div className="stack">
            <div className="hf-card hf-card--icy"><strong className="h4">{t("sess.triggerQuizTitle", { n: triggerQuiz.questions.length })}</strong></div>
            {frozenTq && <div className="hf-card hf-card--icy"><p className="body" style={{ margin: 0 }}>🔒 {t("frz.note")}</p></div>}
            {triggerQuiz.questions.map((q: any) => (
              <div key={q.id} className="hf-card stack">
                <strong className="h4">{q.text}</strong>
                {q.options.map((o: any) => (
                  <div key={o.key} className={`pt-opt ${shown[q.id] === o.key ? "sel" : ""}`} role="button"
                    style={{ cursor: frozenTq ? "default" : "pointer" }}
                    onClick={() => { if (!frozenTq) setTqAnswers((a) => ({ ...a, [q.id]: o.key })); }}>
                    <span className="body" style={{ color: "var(--fg-1)" }}>{o.label}</span>
                  </div>
                ))}
              </div>
            ))}
            {frozenTq
              ? <button className="hf-btn hf-btn--primary hf-btn--block" onClick={() => goToNext()}>{t("common.continue")}</button>
              : <button className="hf-btn hf-btn--primary hf-btn--block" disabled={tqBusy || !triggerQuiz.questions.every((q: any) => tqAnswers[q.id])} onClick={() => void submitTriggerQuiz()}>
                  {tqBusy ? "…" : t("sess.triggerQuizGo")}
                </button>}
          </div>
        );
      })()}
    </div>
  );
}
