import { useEffect, useState } from "react";
import { api, type MediaAsset } from "../lib/api";

type Ex = { type: string; prompt: string; feedbackText: string; options?: { key: string; label: string }[]; correctKey?: string; minChars?: number; fields?: { label: string; placeholder?: string; prefillFromMomentAncrage?: boolean }[] };
type Session = { id: string; title: string; durationEstimate: string; summaryPoints: string[]; video: any; exercise: Ex };
type Block = { index: number; type: string; title: string; payload?: any };
type Content = { blocks: Block[]; [k: string]: unknown };

const field: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--line-strong)", borderRadius: 8, fontFamily: "inherit", fontSize: 13 };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--fg-1)", margin: "0 0 4px" };
const KEYS = ["A", "B", "C", "D", "E"];
const EX_TYPES = [{ v: "multi", l: "QCM (choix multiple)" }, { v: "written", l: "Réponse écrite" }, { v: "guidedForm", l: "Formulaire guidé" }];
const HAS_SESSIONS = ["COMPREHENSION", "PRACTICE", "ANCHORING"];

function newSession(blockIndex: number, n: number): Session {
  return {
    id: `${blockIndex}.${n}`, title: "Nouvelle micro-session", durationEstimate: "15 min",
    summaryPoints: ["", "", ""], video: { title: "Vidéo", url: "", durationSec: 600, keyMessage: "", africanExample: "", errorToAvoid: "", scriptText: "" },
    exercise: { type: "written", prompt: "", feedbackText: "", minChars: 120 },
  };
}

function MediaPicker({ media, onPick }: { media: MediaAsset[]; onPick: (m: MediaAsset) => void }) {
  const [open, setOpen] = useState(false);
  const vids = media.filter((m) => m.kind === "VIDEO");
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="btn btn--sm btn--primary" onClick={() => setOpen((o) => !o)}>🎬 Lier une vidéo</button>
      {open && (
        <div style={{ position: "absolute", zIndex: 30, background: "#fff", border: "1px solid var(--line)", borderRadius: 8, boxShadow: "var(--shadow-md)", maxHeight: 260, overflow: "auto", width: 300, marginTop: 4 }}>
          {vids.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: "var(--fg-3)" }}>Aucune vidéo dans la médiathèque. Téléversez-en d'abord.</div>}
          {vids.map((m) => (
            <button type="button" key={m.id} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 11px", fontSize: 12.5, border: 0, borderBottom: "1px solid var(--line)", background: "none", cursor: "pointer" }} onClick={() => { onPick(m); setOpen(false); }}>
              <b>{m.filename ?? m.id}</b> <span style={{ color: m.status === "READY" ? "var(--success)" : "var(--fg-3)" }}>· {m.status}{m.durationSec ? ` · ${Math.round(m.durationSec / 60)} min` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseEditor({ ex, on }: { ex: Ex; on: (fn: (e: Ex) => void) => void }) {
  return (
    <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
      <div className="row" style={{ gap: 8 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Type d'exercice</label>
          <select style={field} value={ex.type} onChange={(e) => on((x) => {
            x.type = e.target.value;
            if (x.type === "multi" && !x.options) { x.options = [{ key: "A", label: "" }, { key: "B", label: "" }]; x.correctKey = "A"; }
            if (x.type === "written" && !x.minChars) x.minChars = 120;
            if (x.type === "guidedForm" && !x.fields) x.fields = [{ label: "", placeholder: "" }];
          })}>{EX_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
        </div>
        {ex.type === "written" && <div style={{ width: 130 }}><label style={lbl}>Min. caractères</label><input style={field} type="number" min={1} value={ex.minChars ?? 0} onChange={(e) => on((x) => { x.minChars = Number(e.target.value); })} /></div>}
      </div>
      <div><label style={lbl}>Consigne <span className="muted" style={{ fontWeight: 400 }}>({"{{moment_ancrage}}"} autorisé)</span></label><textarea style={{ ...field, minHeight: 50 }} value={ex.prompt} onChange={(e) => on((x) => { x.prompt = e.target.value; })} /></div>

      {ex.type === "multi" && (
        <div>
          <label style={lbl}>Options (cochez la bonne réponse)</label>
          {(ex.options ?? []).map((o, i) => (
            <div className="row" key={i} style={{ gap: 6, marginBottom: 5, alignItems: "center" }}>
              <input type="radio" name={`correct-${Math.random()}`} checked={ex.correctKey === o.key} onChange={() => on((x) => { x.correctKey = o.key; })} title="Bonne réponse" />
              <span style={{ width: 16, fontWeight: 700, fontSize: 12 }}>{o.key}</span>
              <input style={{ ...field, flex: 1 }} value={o.label} placeholder={`Option ${o.key}`} onChange={(e) => on((x) => { x.options![i].label = e.target.value; })} />
              <button type="button" className="btn btn--sm" onClick={() => on((x) => { x.options!.splice(i, 1); if (x.correctKey === o.key) x.correctKey = x.options![0]?.key; })}>✕</button>
            </div>
          ))}
          {(ex.options?.length ?? 0) < 5 && <button type="button" className="btn btn--sm" onClick={() => on((x) => { x.options = x.options ?? []; x.options.push({ key: KEYS[x.options.length], label: "" }); })}>+ Option</button>}
        </div>
      )}
      {ex.type === "guidedForm" && (
        <div>
          <label style={lbl}>Champs du formulaire</label>
          {(ex.fields ?? []).map((f, i) => (
            <div className="row" key={i} style={{ gap: 6, marginBottom: 5 }}>
              <input style={{ ...field, flex: 1 }} value={f.label} placeholder="Intitulé" onChange={(e) => on((x) => { x.fields![i].label = e.target.value; })} />
              <input style={{ ...field, flex: 1 }} value={f.placeholder ?? ""} placeholder="Aide (placeholder)" onChange={(e) => on((x) => { x.fields![i].placeholder = e.target.value; })} />
              <button type="button" className="btn btn--sm" onClick={() => on((x) => { x.fields!.splice(i, 1); })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn--sm" onClick={() => on((x) => { x.fields = x.fields ?? []; x.fields.push({ label: "", placeholder: "" }); })}>+ Champ</button>
        </div>
      )}
      <div><label style={lbl}>Feedback (toujours affiché en entier)</label><textarea style={{ ...field, minHeight: 44 }} value={ex.feedbackText} onChange={(e) => on((x) => { x.feedbackText = e.target.value; })} /></div>
    </div>
  );
}

export function ContentEditor({ content, set }: { content: Content; set: (fn: (c: Content) => void) => void }) {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [bi, setBi] = useState(0);
  useEffect(() => { api.media().then(setMedia).catch(() => {}); }, []);

  const blocks = content.blocks.filter((b) => HAS_SESSIONS.includes(b.type));
  if (blocks.length === 0) return <div className="card"><div className="card-b">Aucun bloc à micro-sessions.</div></div>;
  const block = blocks[Math.min(bi, blocks.length - 1)];
  const realIndex = content.blocks.findIndex((b) => b.index === block.index);
  const sessions: Session[] = block.payload?.microSessions ?? [];

  const onSession = (si: number, fn: (s: Session) => void) => set((c) => { fn(c.blocks[realIndex].payload.microSessions[si]); });

  return (
    <div>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {blocks.map((b, i) => <button key={b.index} className={`btn btn--sm ${i === bi ? "btn--primary" : ""}`} onClick={() => setBi(i)}>Bloc {b.index} · {b.title}</button>)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sessions.map((s, si) => {
          const bound = s.video?.mediaId ? media.find((m) => m.id === s.video.mediaId) : null;
          return (
            <div className="card" key={si}>
              <div className="card-h" style={{ alignItems: "center" }}>
                <h3 style={{ fontSize: 14 }}>Micro-session {s.id}</h3>
                <div className="row" style={{ gap: 5 }}>
                  <button className="btn btn--sm" disabled={si === 0} onClick={() => set((c) => { const a = c.blocks[realIndex].payload.microSessions; [a[si - 1], a[si]] = [a[si], a[si - 1]]; })} title="Monter">↑</button>
                  <button className="btn btn--sm" disabled={si === sessions.length - 1} onClick={() => set((c) => { const a = c.blocks[realIndex].payload.microSessions; [a[si + 1], a[si]] = [a[si], a[si + 1]]; })} title="Descendre">↓</button>
                  <button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => { if (confirm("Supprimer cette micro-session ?")) set((c) => { c.blocks[realIndex].payload.microSessions.splice(si, 1); }); }}>🗑️</button>
                </div>
              </div>
              <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <div className="row" style={{ gap: 10 }}>
                  <div style={{ width: 90 }}><label style={lbl}>Identifiant</label><input style={field} value={s.id} onChange={(e) => onSession(si, (x) => { x.id = e.target.value; })} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Titre</label><input style={field} value={s.title} onChange={(e) => onSession(si, (x) => { x.title = e.target.value; })} /></div>
                  <div style={{ width: 120 }}><label style={lbl}>Durée estimée</label><input style={field} value={s.durationEstimate} onChange={(e) => onSession(si, (x) => { x.durationEstimate = e.target.value; })} /></div>
                </div>

                {/* Video */}
                <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 11 }}>
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <b style={{ fontSize: 12.5 }}>🎬 Vidéo</b>
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      {bound ? <span className="pill pill--green">Liée : {bound.filename ?? bound.id}</span> : s.video?.mediaId ? <span className="pill pill--warn">média {String(s.video.mediaId).slice(0, 8)}…</span> : <span className="pill pill--soft">Aucune vidéo</span>}
                      <MediaPicker media={media} onPick={(m) => onSession(si, (x) => { x.video.mediaId = m.id; if (m.durationSec) x.video.durationSec = m.durationSec; if (!x.video.title || x.video.title === "Vidéo") x.video.title = m.filename ?? x.video.title; })} />
                      {s.video?.mediaId && <button className="btn btn--sm" onClick={() => onSession(si, (x) => { x.video.mediaId = undefined; })}>Délier</button>}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <div style={{ flex: 1 }}><label style={lbl}>Titre de la vidéo</label><input style={field} value={s.video?.title ?? ""} onChange={(e) => onSession(si, (x) => { x.video.title = e.target.value; })} /></div>
                    <div style={{ width: 130 }}><label style={lbl}>Durée (sec)</label><input style={field} type="number" min={1} value={s.video?.durationSec ?? 0} onChange={(e) => onSession(si, (x) => { x.video.durationSec = Number(e.target.value); })} /></div>
                  </div>
                  <div style={{ marginTop: 8 }}><label style={lbl}>Message clé</label><input style={field} value={s.video?.keyMessage ?? ""} onChange={(e) => onSession(si, (x) => { x.video.keyMessage = e.target.value; })} /></div>
                  <div className="row" style={{ gap: 10, marginTop: 8 }}>
                    <div style={{ flex: 1 }}><label style={lbl}>Exemple africain</label><input style={field} value={s.video?.africanExample ?? ""} onChange={(e) => onSession(si, (x) => { x.video.africanExample = e.target.value; })} /></div>
                    <div style={{ flex: 1 }}><label style={lbl}>Erreur à éviter</label><input style={field} value={s.video?.errorToAvoid ?? ""} onChange={(e) => onSession(si, (x) => { x.video.errorToAvoid = e.target.value; })} /></div>
                  </div>
                </div>

                {/* Summary points (exactly 3) */}
                <div>
                  <label style={lbl}>3 points clés à retenir</label>
                  {[0, 1, 2].map((k) => <input key={k} style={{ ...field, marginBottom: 5 }} value={s.summaryPoints?.[k] ?? ""} placeholder={`Point ${k + 1}`} onChange={(e) => onSession(si, (x) => { x.summaryPoints = x.summaryPoints ?? ["", "", ""]; x.summaryPoints[k] = e.target.value; })} />)}
                </div>

                {/* Exercise */}
                <div><label style={lbl}>Exercice</label><ExerciseEditor ex={s.exercise} on={(fn) => onSession(si, (x) => fn(x.exercise))} /></div>
              </div>
            </div>
          );
        })}

        <button className="btn btn--primary" style={{ alignSelf: "flex-start" }} onClick={() => set((c) => { const a = c.blocks[realIndex].payload.microSessions ?? (c.blocks[realIndex].payload.microSessions = []); a.push(newSession(block.index, a.length + 1)); })}>+ Ajouter une micro-session</button>
      </div>
    </div>
  );
}
