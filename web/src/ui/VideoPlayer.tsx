import { useEffect, useRef, useState } from "react";

import { useT } from "../lib/i18n";

const SPEEDS = [0.75, 1, 1.25, 1.5];
const CAP_KEY = "klms_captions"; // "on" | "off" — default on for first-time viewers
const QUAL_KEY = "klms_video_quality"; // "auto" | a rendition label — sticky per learner
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
// Rendition label → i18n key for the quality picker (low-bandwidth choices explicit).
const QKEY: Record<string, string> = { source: "vp.source", "720p": "vp.720p", "480p": "vp.480p", "240p-lite": "vp.240p", audio: "vp.audio" };

/**
 * VideoPlayer — mobile-first player (§4.3) with the Declick video chrome:
 * subtitles default-on + toggle, playback-speed control reachable without
 * full-screen, a periodic position heartbeat (±5s cross-device resume) and
 * resume-seek. When no source is uploaded yet, it shows the player poster
 * (play button + quality/ST/1× chips + scrub) so the session flow still works.
 */
export function VideoPlayer({
  src, captionsUrl, title, startAt = 0, durationSec, quality, watermark, onHeartbeat, onEnded, renditions,
}: {
  src: string | null;
  captionsUrl: string | null;
  title: string;
  startAt?: number;
  durationSec?: number;
  quality?: string | null;
  /** Full playable ladder (lowest-bitrate first) so the learner can force a débit
   *  — essential on slow/3G connections where auto-selection isn't enough. */
  renditions?: { label: string; url: string; bitrateKbps?: number | null }[];
  /** Per-learner overlay (name/e-mail) — a leak deterrent, not a copy block. */
  watermark?: string | null;
  onHeartbeat: (sec: number, durationSec: number | null) => void;
  onEnded: () => void;
}) {
  const t = useT();
  const qlabel = (l: string) => (QKEY[l] ? t(QKEY[l]) : l);
  const ref = useRef<HTMLVideoElement>(null);
  const lastBeat = useRef(0);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState(() => (localStorage.getItem(CAP_KEY) ?? "on") === "on");
  const [qual, setQual] = useState<string>(() => localStorage.getItem(QUAL_KEY) || "auto");
  const [wmPos, setWmPos] = useState({ top: "12%", left: "8%" });
  // Manual quality: pick the chosen rendition's URL, else the auto-resolved src.
  const ladder = (renditions ?? []).filter((r) => r.url);
  const hasChoice = ladder.length > 1;
  const activeSrc = qual === "auto" || !ladder.length ? src : (ladder.find((r) => r.label === qual)?.url ?? src);
  // Preserve playback position + state across a quality switch (the <video> reloads).
  const pendingSeek = useRef<number | null>(null);
  const wasPlaying = useRef(false);
  useEffect(() => { localStorage.setItem(QUAL_KEY, qual); }, [qual]);
  function changeQuality(next: string) {
    const v = ref.current;
    if (v) { pendingSeek.current = v.currentTime; wasPlaying.current = !v.paused; }
    setQual(next);
  }

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
    // After a quality switch, resume exactly where we were; else honour startAt.
    const resume = pendingSeek.current ?? (startAt > 0 ? startAt : 0);
    if (resume > 0 && resume < (v.duration || Infinity)) v.currentTime = resume;
    if (pendingSeek.current != null) { if (wasPlaying.current) void v.play().catch(() => {}); pendingSeek.current = null; }
    const t = v.textTracks?.[0]; if (t) t.mode = captions ? "showing" : "disabled";
  }
  function onTime() {
    const v = ref.current!;
    if (v.currentTime - lastBeat.current >= 10) { lastBeat.current = v.currentTime; onHeartbeat(v.currentTime, Number.isFinite(v.duration) ? v.duration : null); }
  }

  const Controls = () => (
    <div className="row between" style={{ marginTop: 10 }}>
      <div className="row" style={{ gap: 6 }} role="group" aria-label={t("vp.speedAria")}>
        <span className="meta">{t("vp.speed")}</span>
        {SPEEDS.map((sp) => (
          <button key={sp} className={`hf-btn hf-btn--sm ${sp === speed ? "hf-btn--primary" : "hf-btn--outline"}`} onClick={() => setSpeed(sp)}>{sp}×</button>
        ))}
      </div>
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        {hasChoice && (
          <label className="row" style={{ gap: 6, alignItems: "center" }} title="Forcez un débit plus léger sur connexion lente">
            <span className="meta">{t("vp.quality")}</span>
            <select className="hf-field" style={{ width: "auto", padding: "4px 8px" }} value={qual} onChange={(e) => changeQuality(e.target.value)}>
              <option value="auto">{t("vp.auto")}{quality ? ` (${qlabel(quality)})` : ""}</option>
              {ladder.map((r) => <option key={r.label} value={r.label}>{qlabel(r.label)}{r.bitrateKbps ? ` · ${r.bitrateKbps}k` : ""}</option>)}
            </select>
          </label>
        )}
        {captionsUrl && (
          <button className={`hf-btn hf-btn--sm ${captions ? "hf-btn--primary" : "hf-btn--outline"}`} aria-pressed={captions} onClick={() => setCaptions((c) => !c)}>
            ST {captions ? "on" : "off"}
          </button>
        )}
      </div>
    </div>
  );

  // --- poster (no uploaded source) ---
  if (!src) {
    const frac = startAt > 0 && durationSec ? Math.min(1, startAt / durationSec) : 0;
    return (
      <div>
        <div className="hf-media" onClick={onEnded} role="button" title="Lire la vidéo" aria-label={`Lire : ${title}`}>
          <div className="play" />
          <div className="topchip"><span className="hf-livedot" style={{ width: 6, height: 6 }} /> {t("vp.auto")} {quality || "480p"}</div>
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
          ref={ref} src={activeSrc ?? undefined} controls playsInline preload="metadata"
          controlsList="nodownload noplaybackrate" disablePictureInPicture onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={onLoaded} onTimeUpdate={onTime}
          onPause={() => { const v = ref.current!; onHeartbeat(v.currentTime, Number.isFinite(v.duration) ? v.duration : null); }}
          onEnded={onEnded}
        >
          {captionsUrl && <track default kind="subtitles" srcLang="fr" label="Français" src={captionsUrl} />}
        </video>
        {(quality || hasChoice) && <div className="topchip">{qual === "auto" ? `${t("vp.auto")}${quality ? " " + qlabel(quality) : ""}` : qlabel(qual)}</div>}
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
