import { useEffect, useRef, useState } from "react";

const SPEEDS = [0.75, 1, 1.25, 1.5];
const CAP_KEY = "klms_captions"; // "on" | "off" — default on for first-time viewers

/**
 * VideoPlayer — mobile-first player (§4.3): subtitles default-on + toggle,
 * playback-speed control reachable without entering full-screen, a periodic
 * position heartbeat (for ±5s cross-device resume), and resume-seek to startAt.
 * When no playable source exists yet (media not uploaded), it shows a poster
 * with a "watched" action so the session flow still works.
 */
export function VideoPlayer({
  src, captionsUrl, title, startAt = 0, quality, onHeartbeat, onEnded,
}: {
  src: string | null;
  captionsUrl: string | null;
  title: string;
  startAt?: number;
  quality?: string | null;
  onHeartbeat: (sec: number, durationSec: number | null) => void;
  onEnded: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastBeat = useRef(0);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState(() => (localStorage.getItem(CAP_KEY) ?? "on") === "on");

  // Apply caption preference to the text track whenever it or the source changes.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const apply = () => { const t = v.textTracks?.[0]; if (t) t.mode = captions ? "showing" : "disabled"; };
    apply();
    v.textTracks?.addEventListener?.("addtrack", apply);
    return () => v.textTracks?.removeEventListener?.("addtrack", apply);
  }, [captions, captionsUrl, src]);

  useEffect(() => { localStorage.setItem(CAP_KEY, captions ? "on" : "off"); }, [captions]);
  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed]);

  // Flush a final heartbeat when leaving the session.
  useEffect(() => {
    const beat = () => { const v = ref.current; if (v && v.currentTime > 0) onHeartbeat(v.currentTime, Number.isFinite(v.duration) ? v.duration : null); };
    const onHide = () => { if (document.visibilityState === "hidden") beat(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", beat);
    return () => { beat(); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", beat); };
  }, [onHeartbeat]);

  function onLoaded() {
    const v = ref.current!;
    v.playbackRate = speed;
    if (startAt > 0 && startAt < (v.duration || Infinity)) v.currentTime = startAt;
    const t = v.textTracks?.[0]; if (t) t.mode = captions ? "showing" : "disabled";
  }

  function onTime() {
    const v = ref.current!;
    if (v.currentTime - lastBeat.current >= 10) {
      lastBeat.current = v.currentTime;
      onHeartbeat(v.currentTime, Number.isFinite(v.duration) ? v.duration : null);
    }
  }

  if (!src) {
    return (
      <div className="card center" style={{ background: "#0f172a", color: "#fff" }}>
        <p style={{ fontSize: 40, margin: "8px 0" }}>🎬</p>
        <p>{title}</p>
        <p className="muted" style={{ color: "#cbd5e1" }}>Vidéo non disponible sur cet appareil.</p>
        <button className="block" onClick={onEnded}>J'ai regardé la vidéo →</button>
      </div>
    );
  }

  return (
    <div className="stack">
      <video
        ref={ref}
        src={src}
        controls
        playsInline
        preload="metadata"
        style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "16 / 9" }}
        onLoadedMetadata={onLoaded}
        onTimeUpdate={onTime}
        onPause={() => { const v = ref.current!; onHeartbeat(v.currentTime, Number.isFinite(v.duration) ? v.duration : null); }}
        onEnded={onEnded}
      >
        {captionsUrl && <track default kind="subtitles" srcLang="fr" label="Français" src={captionsUrl} />}
      </video>

      {/* Controls reachable without entering full-screen (§4.4). */}
      <div className="row between">
        <div className="row" role="group" aria-label="Vitesse de lecture">
          <span className="muted" style={{ fontSize: 13 }}>Vitesse</span>
          {SPEEDS.map((s) => (
            <button key={s} className={s === speed ? "" : "secondary"} style={{ minHeight: 36, padding: "6px 10px" }} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        {captionsUrl && (
          <button className={captions ? "" : "secondary"} style={{ minHeight: 36, padding: "6px 10px" }}
            aria-pressed={captions} onClick={() => setCaptions((c) => !c)}>
            CC {captions ? "on" : "off"}
          </button>
        )}
      </div>
      {quality && <p className="muted" style={{ margin: 0, fontSize: 12 }}>Qualité auto : {quality}</p>}
    </div>
  );
}
