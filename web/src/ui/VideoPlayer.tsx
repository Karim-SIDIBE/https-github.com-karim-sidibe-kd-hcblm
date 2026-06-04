import { useEffect, useRef, useState } from "react";

const SPEEDS = [0.75, 1, 1.25, 1.5];
const CAP_KEY = "klms_captions"; // "on" | "off" — default on for first-time viewers
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/**
 * VideoPlayer — mobile-first player (§4.3) with the Declick video chrome:
 * subtitles default-on + toggle, playback-speed control reachable without
 * full-screen, a periodic position heartbeat (±5s cross-device resume) and
 * resume-seek. When no source is uploaded yet, it shows the player poster
 * (play button + quality/ST/1× chips + scrub) so the session flow still works.
 */
export function VideoPlayer({
  src, captionsUrl, title, startAt = 0, durationSec, quality, watermark, onHeartbeat, onEnded,
}: {
  src: string | null;
  captionsUrl: string | null;
  title: string;
  startAt?: number;
  durationSec?: number;
  quality?: string | null;
  /** Per-learner overlay (name/e-mail) — a leak deterrent, not a copy block. */
  watermark?: string | null;
  onHeartbeat: (sec: number, durationSec: number | null) => void;
  onEnded: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastBeat = useRef(0);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState(() => (localStorage.getItem(CAP_KEY) ?? "on") === "on");
  const [wmPos, setWmPos] = useState({ top: "12%", left: "8%" });

  // Reposition the watermark periodically so it can't simply be cropped out.
  useEffect(() => {
    if (!watermark) return;
    const id = setInterval(() => setWmPos({ top: `${10 + Math.random() * 70}%`, left: `${5 + Math.random() * 55}%` }), 8000);
    return () => clearInterval(id);
  }, [watermark]);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    const apply = () => { const t = v.textTracks?.[0]; if (t) t.mode = captions ? "showing" : "disabled"; };
    apply();
    v.textTracks?.addEventListener?.("addtrack", apply);
    return () => v.textTracks?.removeEventListener?.("addtrack", apply);
  }, [captions, captionsUrl, src]);

  useEffect(() => { localStorage.setItem(CAP_KEY, captions ? "on" : "off"); }, [captions]);
  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed]);

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
    if (v.currentTime - lastBeat.current >= 10) { lastBeat.current = v.currentTime; onHeartbeat(v.currentTime, Number.isFinite(v.duration) ? v.duration : null); }
  }

  const Controls = () => (
    <div className="row between" style={{ marginTop: 10 }}>
      <div className="row" style={{ gap: 6 }} role="group" aria-label="Vitesse de lecture">
        <span className="meta">Vitesse</span>
        {SPEEDS.map((sp) => (
          <button key={sp} className={`hf-btn hf-btn--sm ${sp === speed ? "hf-btn--primary" : "hf-btn--outline"}`} onClick={() => setSpeed(sp)}>{sp}×</button>
        ))}
      </div>
      {captionsUrl && (
        <button className={`hf-btn hf-btn--sm ${captions ? "hf-btn--primary" : "hf-btn--outline"}`} aria-pressed={captions} onClick={() => setCaptions((c) => !c)}>
          ST {captions ? "on" : "off"}
        </button>
      )}
    </div>
  );

  // --- poster (no uploaded source) ---
  if (!src) {
    const frac = startAt > 0 && durationSec ? Math.min(1, startAt / durationSec) : 0;
    return (
      <div>
        <div className="hf-media" onClick={onEnded} role="button" title="Lire la vidéo" aria-label={`Lire : ${title}`}>
          <div className="play" />
          <div className="topchip"><span className="hf-livedot" style={{ width: 6, height: 6 }} /> Auto {quality || "480p"}</div>
          <div className="chips"><span className="chip">ST</span><span className="chip">1×</span></div>
          <div className="scrub"><i style={{ width: `${frac * 100}%` }} /></div>
        </div>
        <p className="meta accent" style={{ marginTop: 8 }}>
          Touchez pour lire{startAt > 0 ? ` · ↺ reprise ${mmss(startAt)}` : ""}
        </p>
        <Controls />
      </div>
    );
  }

  // --- real player ---
  return (
    <div>
      <div className="hf-media" style={{ position: "relative" }}>
        <video
          ref={ref} src={src} controls playsInline preload="metadata"
          controlsList="nodownload noplaybackrate" disablePictureInPicture onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={onLoaded} onTimeUpdate={onTime}
          onPause={() => { const v = ref.current!; onHeartbeat(v.currentTime, Number.isFinite(v.duration) ? v.duration : null); }}
          onEnded={onEnded}
        >
          {captionsUrl && <track default kind="subtitles" srcLang="fr" label="Français" src={captionsUrl} />}
        </video>
        {quality && <div className="topchip">Auto {quality}</div>}
        {watermark && (
          <div aria-hidden style={{ position: "absolute", top: wmPos.top, left: wmPos.left, pointerEvents: "none", userSelect: "none",
            color: "rgba(255,255,255,0.32)", fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
            textShadow: "0 1px 2px rgba(0,0,0,0.65)", whiteSpace: "nowrap", zIndex: 3, transition: "top .6s, left .6s" }}>
            {watermark}
          </div>
        )}
      </div>
      <Controls />
    </div>
  );
}
