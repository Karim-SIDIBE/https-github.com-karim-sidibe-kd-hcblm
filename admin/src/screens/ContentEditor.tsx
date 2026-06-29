import { useEffect, useState } from "react";
import { api, type MediaAsset } from "../lib/api";

type Opt = { key: string; label: string };
type Ex = { type: string; prompt: string; feedbackText: string; options?: Opt[]; correctKey?: string; minChars?: number; fields?: { label: string; placeholder?: string }[] };
type Session = { id: string; title: string; durationEstimate: string; summaryPoints: string[]; video: any; exercise: Ex };
type SQ = {
  id: string; scenarioText: string; feedbackText: string; subArea?: string;
  type?: "single" | "multiple" | "truefalse" | "numeric" | "short";
  options?: Opt[]; correctKey?: string; correctKeys?: string[]; correctBool?: boolean; answerNumber?: number; tolerance?: number; accepted?: string[];
};
type TQ = { id: string; text: string; options: Opt[] };
type Block = { index: number; type: string; title: string; payload?: any };
type Content = { blocks: Block[]; [k: string]: unknown };
type Set = (fn: (c: Content) => void) => void;

const field: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--line-strong)", borderRadius: 8, fontFamily: "inherit", fontSize: 13 };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--fg-1)", margin: "0 0 4px" };
const KEYS = ["A", "B", "C", "D", "E"];
const EX_TYPES = [{ v: "multi", l: "QCM" }, { v: "written", l: "Réponse écrite" }, { v: "guidedForm", l: "Formulaire guidé" }];
const SQ_TYPES = [{ v: "single", l: "QCM (réponse unique)" }, { v: "multiple", l: "Choix multiples" }, { v: "truefalse", l: "Vrai / Faux" }, { v: "numeric", l: "Numérique" }, { v: "short", l: "Réponse courte" }];
const TYPE_FR: Record<string, string> = { ONBOARDING: "Onboarding", COMPREHENSION: "Compréhension", PRACTICE: "Pratique", ANCHORING: "Ancrage", CERTIFICATION: "Certification" };

const newSession = (bi: number, n: number): Session => ({ id: `${bi}.${n}`, title: "Nouvelle micro-session", durationEstimate: "15 min", summaryPoints: ["", "", ""], video: { title: "Vidéo", url: "", durationSec: 600, keyMessage: "", africanExample: "", errorToAvoid: "", scriptText: "" }, exercise: { type: "written", prompt: "", feedbackText: "", minChars: 120 } });
const newSQ = (n: number): SQ => ({ id: `q${n}`, scenarioText: "", options: [{ key: "A", label: "" }, { key: "B", label: "" }], correctKey: "A", feedbackText: "", subArea: "" });
const newTQ = (n: number): TQ => ({ id: `t${n}`, text: "", options: [{ key: "A", label: "" }, { key: "B", label: "" }] });

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="card"><div className="card-h"><h3 style={{ fontSize: 14 }}>{title}</h3>{action}</div><div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 11 }}>{children}</div></div>;
}

/* ---------------- drag-and-drop reordering (native HTML5) ---------------- */
function move<T>(a: T[], from: number, to: number): T[] { const b = a.slice(); const [x] = b.splice(from, 1); b.splice(to, 0, x); return b; }
function useDnd(onMove: (from: number, to: number) => void) {
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return {
    over,
    row: (i: number) => ({
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (over !== i) setOver(i); },
      onDrop: (e: React.DragEvent) => { e.preventDefault(); if (from != null && from !== i) onMove(from, i); setFrom(null); setOver(null); },
    }),
    handleProps: (i: number) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => { setFrom(i); e.dataTransfer.effectAllowed = "move"; },
      onDragEnd: () => { setFrom(null); setOver(null); },
      title: "Glisser pour réordonner",
      style: { cursor: "grab", userSelect: "none" as const, color: "var(--fg-3)", fontSize: 15, lineHeight: 1, padding: "0 2px" },
    }),
  };
}
const Grip = (p: any) => <span {...p}>⠿</span>;

/* ---------------- options editor (shared) ---------------- */
function Options({ opts, correctKey, correctKeys, scored, path, set }: { opts: Opt[]; correctKey?: string; correctKeys?: string[]; scored: boolean; path: (c: Content) => { options: Opt[]; correctKey?: string; correctKeys?: string[] }; set: Set }) {
  const multi = Array.isArray(correctKeys); // multiple-select mode
  return (
    <div>
      {opts.map((o, i) => (
        <div className="row" key={i} style={{ gap: 6, marginBottom: 5, alignItems: "center" }}>
          {scored && (multi
            ? <input type="checkbox" checked={(correctKeys ?? []).includes(o.key)} title="Bonne réponse" onChange={() => set((c) => { const p = path(c); const s = new Set(p.correctKeys ?? []); s.has(o.key) ? s.delete(o.key) : s.add(o.key); p.correctKeys = [...s].sort(); })} />
            : <input type="radio" checked={correctKey === o.key} title="Bonne réponse" onChange={() => set((c) => { path(c).correctKey = o.key; })} />)}
          <span style={{ width: 16, fontWeight: 700, fontSize: 12 }}>{o.key}</span>
          <input style={{ ...field, flex: 1 }} value={o.label} placeholder={`Option ${o.key}`} onChange={(e) => set((c) => { path(c).options[i].label = e.target.value; })} />
          <button type="button" className="btn btn--sm" disabled={opts.length <= 2} onClick={() => set((c) => { const p = path(c); p.options.splice(i, 1); if (p.correctKey === o.key) p.correctKey = p.options[0]?.key; if (p.correctKeys) p.correctKeys = p.correctKeys.filter((k) => k !== o.key); })}>✕</button>
        </div>
      ))}
      {opts.length < 5 && <button type="button" className="btn btn--sm" onClick={() => set((c) => { const p = path(c); p.options.push({ key: KEYS[p.options.length], label: "" }); })}>+ Option</button>}
    </div>
  );
}

/* ---------------- scored questions (diagnostic / interblock / final) ---------------- */
function ScoredQuestions({ questions, path, set }: { questions: SQ[]; path: (c: Content) => SQ[]; set: Set }) {
  const dnd = useDnd((from, to) => set((c) => { const a = path(c); a.splice(0, a.length, ...move(a, from, to)); }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {questions.map((q, qi) => (
        <div key={qi} {...dnd.row(qi)} style={{ border: `1px solid ${dnd.over === qi ? "var(--orange-400)" : "var(--line)"}`, borderRadius: 8, padding: 11 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="row" style={{ gap: 6, alignItems: "center" }}><Grip {...dnd.handleProps(qi)} /><b style={{ fontSize: 12.5 }}>Question {qi + 1}</b></span>
            <button type="button" className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} disabled={questions.length <= 1} onClick={() => set((c) => { path(c).splice(qi, 1); })}>🗑️</button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ width: 90 }}><label style={lbl}>Id</label><input style={field} value={q.id} onChange={(e) => set((c) => { path(c)[qi].id = e.target.value; })} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Sous-domaine <span className="muted" style={{ fontWeight: 400 }}>(optionnel)</span></label><input style={field} value={q.subArea ?? ""} onChange={(e) => set((c) => { path(c)[qi].subArea = e.target.value; })} /></div>
          </div>
          <div style={{ marginTop: 8 }}><label style={lbl}>Scénario / énoncé</label><textarea style={{ ...field, minHeight: 48 }} value={q.scenarioText} onChange={(e) => set((c) => { path(c)[qi].scenarioText = e.target.value; })} /></div>
          <div style={{ marginTop: 8, width: 220 }}><label style={lbl}>Type de question</label>
            <select style={field} value={q.type ?? "single"} onChange={(e) => set((c) => {
              const x = path(c)[qi]; const nt = e.target.value as SQ["type"];
              x.type = nt === "single" ? undefined : nt; // keep legacy single clean (no type field)
              if (nt === "single" || nt === "multiple") { if (!x.options || x.options.length < 2) x.options = [{ key: "A", label: "" }, { key: "B", label: "" }]; }
              if (nt === "single" && !x.correctKey) x.correctKey = "A";
              if (nt === "multiple" && !x.correctKeys) x.correctKeys = [];
              if (nt === "truefalse" && typeof x.correctBool !== "boolean") x.correctBool = true;
              if (nt === "numeric" && typeof x.answerNumber !== "number") x.answerNumber = 0;
              if (nt === "short" && (!x.accepted || x.accepted.length === 0)) x.accepted = [""];
            })}>{SQ_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
          </div>
          {(() => { const ty = q.type ?? "single"; return <>
            {(ty === "single" || ty === "multiple") && (
              <div style={{ marginTop: 8 }}><label style={lbl}>{ty === "multiple" ? "Options (cochez les bonnes réponses)" : "Options (cochez la bonne réponse)"}</label>
                <Options opts={q.options ?? []} correctKey={q.correctKey} correctKeys={ty === "multiple" ? (q.correctKeys ?? []) : undefined} scored path={(c) => path(c)[qi] as { options: Opt[]; correctKey?: string; correctKeys?: string[] }} set={set} />
              </div>
            )}
            {ty === "truefalse" && (
              <div style={{ marginTop: 8 }}><label style={lbl}>Bonne réponse</label>
                <div className="row" style={{ gap: 16 }}>
                  <label className="row" style={{ gap: 6, alignItems: "center" }}><input type="radio" checked={q.correctBool === true} onChange={() => set((c) => { path(c)[qi].correctBool = true; })} /> Vrai</label>
                  <label className="row" style={{ gap: 6, alignItems: "center" }}><input type="radio" checked={q.correctBool === false} onChange={() => set((c) => { path(c)[qi].correctBool = false; })} /> Faux</label>
                </div>
              </div>
            )}
            {ty === "numeric" && (
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Réponse attendue</label><input style={field} type="number" value={q.answerNumber ?? 0} onChange={(e) => set((c) => { path(c)[qi].answerNumber = Number(e.target.value); })} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>Tolérance ± <span className="muted" style={{ fontWeight: 400 }}>(optionnel)</span></label><input style={field} type="number" min={0} value={q.tolerance ?? 0} onChange={(e) => set((c) => { path(c)[qi].tolerance = Number(e.target.value); })} /></div>
              </div>
            )}
            {ty === "short" && (
              <div style={{ marginTop: 8 }}><label style={lbl}>Réponses acceptées <span className="muted" style={{ fontWeight: 400 }}>(insensible à la casse et aux accents)</span></label>
                {(q.accepted ?? [""]).map((ans, ai) => (
                  <div className="row" key={ai} style={{ gap: 6, marginBottom: 5, alignItems: "center" }}>
                    <input style={{ ...field, flex: 1 }} value={ans} placeholder={`Réponse ${ai + 1}`} onChange={(e) => set((c) => { const x = path(c)[qi]; (x.accepted ??= [""])[ai] = e.target.value; })} />
                    <button type="button" className="btn btn--sm" disabled={(q.accepted?.length ?? 1) <= 1} onClick={() => set((c) => { path(c)[qi].accepted?.splice(ai, 1); })}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn--sm" onClick={() => set((c) => { (path(c)[qi].accepted ??= [""]).push(""); })}>+ Réponse acceptée</button>
              </div>
            )}
          </>; })()}
          <div style={{ marginTop: 8 }}><label style={lbl}>Feedback</label><textarea style={{ ...field, minHeight: 40 }} value={q.feedbackText} onChange={(e) => set((c) => { path(c)[qi].feedbackText = e.target.value; })} /></div>
        </div>
      ))}
      <button type="button" className="btn btn--sm btn--primary" style={{ alignSelf: "flex-start" }} onClick={() => set((c) => { const a = path(c); a.push(newSQ(a.length + 1)); })}>+ Question</button>
    </div>
  );
}

/* ---------------- trigger questions (Bloc 0, non scored) ---------------- */
function TriggerQuestions({ questions, path, set }: { questions: TQ[]; path: (c: Content) => TQ[]; set: Set }) {
  const dnd = useDnd((from, to) => set((c) => { const a = path(c); a.splice(0, a.length, ...move(a, from, to)); }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {questions.map((q, qi) => (
        <div key={qi} {...dnd.row(qi)} style={{ border: `1px solid ${dnd.over === qi ? "var(--orange-400)" : "var(--line)"}`, borderRadius: 8, padding: 11 }}>
          <div className="row between" style={{ marginBottom: 8 }}><span className="row" style={{ gap: 6, alignItems: "center" }}><Grip {...dnd.handleProps(qi)} /><b style={{ fontSize: 12.5 }}>Question {qi + 1}</b></span>
            <button type="button" className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} disabled={questions.length <= 1} onClick={() => set((c) => { path(c).splice(qi, 1); })}>🗑️</button></div>
          <div><label style={lbl}>Question</label><input style={field} value={q.text} onChange={(e) => set((c) => { path(c)[qi].text = e.target.value; })} /></div>
          <div style={{ marginTop: 8 }}><label style={lbl}>Réponses possibles</label>
            <Options opts={q.options} scored={false} path={(c) => path(c)[qi]} set={set} />
          </div>
        </div>
      ))}
      <button type="button" className="btn btn--sm btn--primary" style={{ alignSelf: "flex-start" }} onClick={() => set((c) => { const a = path(c); a.push(newTQ(a.length + 1)); })}>+ Question</button>
    </div>
  );
}

/* ---------------- exercise (inside a micro-session) ---------------- */
function ExerciseEditor({ ex, path, set }: { ex: Ex; path: (c: Content) => Ex; set: Set }) {
  return (
    <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
      <div className="row" style={{ gap: 8 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Type d'exercice</label>
          <select style={field} value={ex.type} onChange={(e) => set((c) => { const x = path(c); x.type = e.target.value; if (x.type === "multi" && !x.options) { x.options = [{ key: "A", label: "" }, { key: "B", label: "" }]; x.correctKey = "A"; } if (x.type === "written" && !x.minChars) x.minChars = 120; if (x.type === "guidedForm" && !x.fields) x.fields = [{ label: "", placeholder: "" }]; })}>
            {EX_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        {ex.type === "written" && <div style={{ width: 130 }}><label style={lbl}>Min. caractères</label><input style={field} type="number" min={1} value={ex.minChars ?? 0} onChange={(e) => set((c) => { path(c).minChars = Number(e.target.value); })} /></div>}
      </div>
      <div><label style={lbl}>Consigne <span className="muted" style={{ fontWeight: 400 }}>({"{{moment_ancrage}}"} autorisé)</span></label><textarea style={{ ...field, minHeight: 46 }} value={ex.prompt} onChange={(e) => set((c) => { path(c).prompt = e.target.value; })} /></div>
      {ex.type === "multi" && <div><label style={lbl}>Options (cochez la bonne réponse)</label><Options opts={ex.options ?? []} correctKey={ex.correctKey} scored path={(c) => path(c) as any} set={set} /></div>}
      {ex.type === "guidedForm" && (
        <div><label style={lbl}>Champs</label>
          {(ex.fields ?? []).map((f, i) => (
            <div className="row" key={i} style={{ gap: 6, marginBottom: 5 }}>
              <input style={{ ...field, flex: 1 }} value={f.label} placeholder="Intitulé" onChange={(e) => set((c) => { path(c).fields![i].label = e.target.value; })} />
              <input style={{ ...field, flex: 1 }} value={f.placeholder ?? ""} placeholder="Aide" onChange={(e) => set((c) => { path(c).fields![i].placeholder = e.target.value; })} />
              <button type="button" className="btn btn--sm" onClick={() => set((c) => { path(c).fields!.splice(i, 1); })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn--sm" onClick={() => set((c) => { const x = path(c); x.fields = x.fields ?? []; x.fields.push({ label: "", placeholder: "" }); })}>+ Champ</button>
        </div>
      )}
      <div><label style={lbl}>Feedback</label><textarea style={{ ...field, minHeight: 40 }} value={ex.feedbackText} onChange={(e) => set((c) => { path(c).feedbackText = e.target.value; })} /></div>
    </div>
  );
}

/* ---------------- media picker ---------------- */
function MediaPicker({ media, onPick }: { media: MediaAsset[]; onPick: (m: MediaAsset) => void }) {
  const [open, setOpen] = useState(false);
  const vids = media.filter((m) => m.kind === "VIDEO");
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="btn btn--sm btn--primary" onClick={() => setOpen((o) => !o)}>🎬 Lier une vidéo</button>
      {open && (
        <div style={{ position: "absolute", zIndex: 30, right: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 8, boxShadow: "var(--shadow-md)", maxHeight: 260, overflow: "auto", width: 300, marginTop: 4 }}>
          {vids.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: "var(--fg-3)" }}>Aucune vidéo. Téléversez-en dans la Médiathèque.</div>}
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

/* ---------------- micro-session card ---------------- */
function SessionCard({ s, si, total, ri, media, set, handleProps }: { s: Session; si: number; total: number; ri: number; media: MediaAsset[]; set: Set; handleProps?: any }) {
  const arr = (c: Content) => c.blocks[ri].payload.microSessions as Session[];
  const onS = (fn: (x: Session) => void) => set((c) => fn(arr(c)[si]));
  const bound = s.video?.mediaId ? media.find((m) => m.id === s.video.mediaId) : null;
  return (
    <div className="card">
      <div className="card-h" style={{ alignItems: "center" }}>
        <h3 className="row" style={{ fontSize: 13.5, gap: 7, alignItems: "center" }}>{handleProps && <Grip {...handleProps} />}Micro-session {s.id}{s.title ? <span className="muted" style={{ fontWeight: 400 }}>— {s.title}</span> : null}</h3>
        <div className="row" style={{ gap: 5 }}>
          <button className="btn btn--sm" disabled={si === 0} onClick={() => set((c) => { const a = arr(c); [a[si - 1], a[si]] = [a[si], a[si - 1]]; })}>↑</button>
          <button className="btn btn--sm" disabled={si === total - 1} onClick={() => set((c) => { const a = arr(c); [a[si + 1], a[si]] = [a[si], a[si + 1]]; })}>↓</button>
          <button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => { if (confirm("Supprimer cette micro-session ?")) set((c) => { arr(c).splice(si, 1); }); }}>🗑️</button>
        </div>
      </div>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 90 }}><label style={lbl}>Identifiant</label><input style={field} value={s.id} onChange={(e) => onS((x) => { x.id = e.target.value; })} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Titre</label><input style={field} value={s.title} onChange={(e) => onS((x) => { x.title = e.target.value; })} /></div>
          <div style={{ width: 120 }}><label style={lbl}>Durée estimée</label><input style={field} value={s.durationEstimate} onChange={(e) => onS((x) => { x.durationEstimate = e.target.value; })} /></div>
        </div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 11 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <b style={{ fontSize: 12.5 }}>🎬 Vidéo</b>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              {bound ? <span className="pill pill--green">Liée : {bound.filename ?? bound.id}</span> : s.video?.mediaId ? <span className="pill pill--warn">média {String(s.video.mediaId).slice(0, 8)}…</span> : <span className="pill pill--soft">Aucune</span>}
              <MediaPicker media={media} onPick={(m) => onS((x) => { x.video.mediaId = m.id; if (m.durationSec) x.video.durationSec = m.durationSec; if (!x.video.title || x.video.title === "Vidéo") x.video.title = m.filename ?? x.video.title; })} />
              {s.video?.mediaId && <button className="btn btn--sm" onClick={() => onS((x) => { x.video.mediaId = undefined; })}>Délier</button>}
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}><label style={lbl}>Titre de la vidéo</label><input style={field} value={s.video?.title ?? ""} onChange={(e) => onS((x) => { x.video.title = e.target.value; })} /></div>
            <div style={{ width: 120 }}><label style={lbl}>Durée (sec)</label><input style={field} type="number" min={1} value={s.video?.durationSec ?? 0} onChange={(e) => onS((x) => { x.video.durationSec = Number(e.target.value); })} /></div>
          </div>
          <div style={{ marginTop: 8 }}><label style={lbl}>Message clé</label><input style={field} value={s.video?.keyMessage ?? ""} onChange={(e) => onS((x) => { x.video.keyMessage = e.target.value; })} /></div>
        </div>
        <div><label style={lbl}>3 points clés</label>{[0, 1, 2].map((k) => <input key={k} style={{ ...field, marginBottom: 5 }} value={s.summaryPoints?.[k] ?? ""} placeholder={`Point ${k + 1}`} onChange={(e) => onS((x) => { x.summaryPoints = x.summaryPoints ?? ["", "", ""]; x.summaryPoints[k] = e.target.value; })} />)}</div>
        <div><label style={lbl}>Exercice</label><ExerciseEditor ex={s.exercise} path={(c) => arr(c)[si].exercise} set={set} /></div>
      </div>
    </div>
  );
}

/* ---------------- string list ---------------- */
function StringList({ items, path, set, ph }: { items: string[]; path: (c: Content) => string[]; set: Set; ph: string }) {
  return (
    <div>
      {(items ?? []).map((it, i) => (
        <div className="row" key={i} style={{ gap: 6, marginBottom: 5 }}>
          <input style={{ ...field, flex: 1 }} value={it} placeholder={`${ph} ${i + 1}`} onChange={(e) => set((c) => { path(c)[i] = e.target.value; })} />
          <button type="button" className="btn btn--sm" onClick={() => set((c) => { path(c).splice(i, 1); })}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn--sm" onClick={() => set((c) => { (path(c) ?? []).push(""); })}>+ Ajouter</button>
    </div>
  );
}

/* ---------------- guided scenarios (Bloc 2) ---------------- */
function GuidedScenarios({ scenarios, ri, set }: { scenarios: any[]; ri: number; set: Set }) {
  const arr = (c: Content) => c.blocks[ri].payload.guidedScenarios as any[];
  const dnd = useDnd((from, to) => set((c) => { const a = arr(c); a.splice(0, a.length, ...move(a, from, to)); }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {scenarios.map((sc, i) => (
        <div key={i} {...dnd.row(i)} style={{ border: `1px solid ${dnd.over === i ? "var(--orange-400)" : "var(--line)"}`, borderRadius: 8, padding: 11 }}>
          <div className="row between" style={{ marginBottom: 8 }}><span className="row" style={{ gap: 6, alignItems: "center" }}><Grip {...dnd.handleProps(i)} /><b style={{ fontSize: 12.5 }}>Scénario {i + 1}</b></span>
            <button type="button" className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => set((c) => { arr(c).splice(i, 1); })}>🗑️</button></div>
          <div><label style={lbl}>Titre</label><input style={field} value={sc.title ?? ""} onChange={(e) => set((c) => { arr(c)[i].title = e.target.value; })} /></div>
          <div style={{ marginTop: 8 }}><label style={lbl}>Contexte africain</label><input style={field} value={sc.contextAfricain ?? ""} onChange={(e) => set((c) => { arr(c)[i].contextAfricain = e.target.value; })} /></div>
          <div style={{ marginTop: 8 }}><label style={lbl}>Étapes</label>
            {(sc.steps ?? []).map((st: any, j: number) => (
              <div key={j} style={{ background: "var(--bg-soft)", borderRadius: 8, padding: 10, marginBottom: 6 }}>
                <div className="row between"><b style={{ fontSize: 12 }}>Étape {j + 1}</b><button type="button" className="btn btn--sm" onClick={() => set((c) => { arr(c)[i].steps.splice(j, 1); })}>✕</button></div>
                <input style={{ ...field, margin: "6px 0" }} value={st.question ?? ""} placeholder="Question" onChange={(e) => set((c) => { arr(c)[i].steps[j].question = e.target.value; })} />
                <Options opts={st.options ?? []} correctKey={st.correctKey} scored path={(c) => arr(c)[i].steps[j]} set={set} />
                <input style={{ ...field, marginTop: 6 }} value={st.feedback ?? ""} placeholder="Feedback" onChange={(e) => set((c) => { arr(c)[i].steps[j].feedback = e.target.value; })} />
              </div>
            ))}
            <button type="button" className="btn btn--sm" onClick={() => set((c) => { (arr(c)[i].steps ??= []).push({ question: "", options: [{ key: "A", label: "" }, { key: "B", label: "" }], correctKey: "A", feedback: "" }); })}>+ Étape</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn--sm btn--primary" style={{ alignSelf: "flex-start" }} onClick={() => set((c) => { (arr(c) ?? (c.blocks[ri].payload.guidedScenarios = [])).push({ title: "", contextAfricain: "", steps: [] }); })}>+ Scénario</button>
    </div>
  );
}

/* ---------------- auditable units (v2.1 typology) ---------------- */
type Unit = { label: string; type: string; durationMin?: number };
const UNIT_TYPES = [{ v: "micro-session", l: "Micro-session" }, { v: "long-activity", l: "Activité longue" }, { v: "micro-task", l: "Micro-tâche" }];
function counts(units?: Unit[]) { const c = { ms: 0, la: 0, mt: 0 }; for (const u of units ?? []) { if (u.type === "micro-session") c.ms++; else if (u.type === "long-activity") c.la++; else if (u.type === "micro-task") c.mt++; } return c; }
function genUnits(block: any): Unit[] {
  const p = block.payload ?? {}; const u: Unit[] = [];
  const push = (label: string, type: string, durationMin: number) => u.push({ label, type, durationMin });
  if (block.type === "ONBOARDING") { push("Onboarding & ancrage", "micro-session", 10); push("Vidéo déclencheur + quiz", "micro-session", 15); }
  if (p.diagnosticQuiz) push("Quiz diagnostique", "micro-session", 15);
  (p.microSessions ?? []).forEach((s: any) => push(`Micro-session ${s.id} — ${s.title}`, "micro-session", 20));
  if (p.caseStudy) push(`Étude de cas — ${p.caseStudy.title}`, "long-activity", 25);
  if (p.guidedScenarios?.length) push("Mises en situation guidées", "long-activity", 40);
  if (p.fieldApplication) push("Application terrain", "long-activity", 35);
  if (p.selfAssessment) push("Auto-évaluation", "micro-session", 15);
  if (p.actionPlan30d) push("Plan d'action 30 jours", "micro-session", 20);
  if (p.finalQuiz) push("Quiz final", "micro-session", 15);
  if (block.type === "CERTIFICATION") {
    (p.sections ?? []).forEach((s: any, i: number) => push(`Section ${i + 1} — ${s.title}`, "micro-session", 15));
    if (p.journal?.entries) { push("Journal de pratique (2 semaines)", "long-activity", 30); (p.journal.entries).forEach((e: any) => push(`Journal J+${e.day}`, "micro-task", 5)); }
  }
  return u;
}
function CountBadges({ units }: { units?: Unit[] }) {
  const c = counts(units);
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <span className="pill pill--green">{c.ms} micro-session{c.ms > 1 ? "s" : ""}</span>
      <span className="pill pill--warn">{c.la} activité{c.la > 1 ? "s" : ""} longue{c.la > 1 ? "s" : ""}</span>
      <span className="pill pill--soft">{c.mt} micro-tâche{c.mt > 1 ? "s" : ""}</span>
    </div>
  );
}
function UnitsCard({ block, ri, set }: { block: any; ri: number; set: Set }) {
  const units: Unit[] = block.units ?? [];
  const arr = (c: Content) => ((c.blocks[ri] as any).units ??= []);
  const dnd = useDnd((from, to) => set((c) => { const a = arr(c); a.splice(0, a.length, ...move(a, from, to)); }));
  return (
    <Card title="Unités auditables du bloc" action={<CountBadges units={units} />}>
      {units.length === 0 && <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Aucune unité déclarée. Pré-remplissez depuis le contenu, puis ajustez les types (auditabilité v2.1).</p>}
      {units.map((u, i) => (
        <div className="row" key={i} {...dnd.row(i)} style={{ gap: 8, alignItems: "center", borderRadius: 8, outline: dnd.over === i ? "1px solid var(--orange-400)" : "none" }}>
          <Grip {...dnd.handleProps(i)} />
          <input style={{ ...field, flex: 1 }} value={u.label} placeholder="Intitulé de l'unité" onChange={(e) => set((c) => { arr(c)[i].label = e.target.value; })} />
          <select style={{ ...field, width: 165 }} value={u.type} onChange={(e) => set((c) => { arr(c)[i].type = e.target.value; })}>{UNIT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
          <input style={{ ...field, width: 80 }} type="number" min={1} value={u.durationMin ?? 0} onChange={(e) => set((c) => { arr(c)[i].durationMin = Number(e.target.value); })} title="minutes" />
          <button type="button" className="btn btn--sm" onClick={() => set((c) => { arr(c).splice(i, 1); })}>✕</button>
        </div>
      ))}
      <div className="row" style={{ gap: 8, marginTop: 6 }}>
        <button type="button" className="btn btn--sm" onClick={() => set((c) => { arr(c).push({ label: "", type: "micro-session", durationMin: 20 }); })}>+ Unité</button>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => { if (units.length && !confirm("Remplacer les unités déclarées par celles générées depuis le contenu ?")) return; set((c) => { (c.blocks[ri] as any).units = genUnits(c.blocks[ri]); }); }}>⟳ Pré-remplir depuis le contenu</button>
      </div>
    </Card>
  );
}

/* ---------------- per-block editor ---------------- */
function ImportedNote({ text, onClear }: { text: string; onClear?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card" style={{ borderColor: "var(--orange-400)" }}>
      <div className="card-h">
        <h3 style={{ fontSize: 14 }}>📋 Texte importé du Word — à répartir</h3>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn--sm" onClick={() => navigator.clipboard?.writeText(text)}>Copier</button>
          <button type="button" className="btn btn--sm" onClick={() => setOpen((o) => !o)}>{open ? "Masquer" : "Afficher"}</button>
          {onClear && <button type="button" className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={onClear} title="Fermer une fois le texte réparti">✓ Traité</button>}
        </div>
      </div>
      {open && <div className="card-b"><textarea readOnly value={text} style={{ width: "100%", minHeight: 120, fontSize: 12.5, fontFamily: "inherit", border: "1px solid var(--line)", borderRadius: 8, padding: 10, background: "var(--bg-soft)", lineHeight: 1.5 }} /><span className="muted" style={{ fontSize: 11.5 }}>Copiez ce texte dans les bons champs ci-dessous (micro-sessions, quiz, étude de cas…), puis cliquez « ✓ Traité ».</span></div>}
    </div>
  );
}

function BlockEditor({ block, ri, media, set, note, onClearNote }: { block: Block; ri: number; media: MediaAsset[]; set: Set; note?: string; onClearNote?: () => void }) {
  const p = block.payload ?? {};
  const sessions: Session[] = p.microSessions ?? [];
  const addSession = () => set((c) => { const a = (c.blocks[ri].payload.microSessions ??= []); a.push(newSession(block.index, a.length + 1)); });
  const tv = p.triggerVideo;
  const sdnd = useDnd((from, to) => set((c) => { const a = c.blocks[ri].payload.microSessions as Session[]; a.splice(0, a.length, ...move(a, from, to)); }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {note && <ImportedNote text={note} onClear={onClearNote} />}
      <UnitsCard block={block} ri={ri} set={set} />

      {/* ---- Bloc 0 ---- */}
      {block.type === "ONBOARDING" && (
        <>
          {p.momentAncrage && (
            <Card title="Moment d'Ancrage (PAM)">
              <div><label style={lbl}>Consigne</label><textarea style={{ ...field, minHeight: 46 }} value={p.momentAncrage.promptText ?? ""} onChange={(e) => set((c) => { c.blocks[ri].payload.momentAncrage.promptText = e.target.value; })} /></div>
              <div className="row" style={{ gap: 10 }}>
                <div style={{ width: 140 }}><label style={lbl}>Min. caractères</label><input style={field} type="number" min={1} value={p.momentAncrage.minChars ?? 50} onChange={(e) => set((c) => { c.blocks[ri].payload.momentAncrage.minChars = Number(e.target.value); })} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>Exemple (placeholder)</label><input style={field} value={p.momentAncrage.placeholderExample ?? ""} onChange={(e) => set((c) => { c.blocks[ri].payload.momentAncrage.placeholderExample = e.target.value; })} /></div>
              </div>
            </Card>
          )}
          {p.profileChoices && (
            <Card title="Profils d'auto-identification">
              {p.profileChoices.map((pc: any, i: number) => (
                <div key={i} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                  <input style={{ ...field, width: 50 }} value={pc.key ?? ""} onChange={(e) => set((c) => { c.blocks[ri].payload.profileChoices[i].key = e.target.value; })} />
                  <input style={{ ...field, flex: 1 }} value={pc.name ?? ""} placeholder="Nom du profil" onChange={(e) => set((c) => { c.blocks[ri].payload.profileChoices[i].name = e.target.value; })} />
                  <input style={{ ...field, flex: 2 }} value={pc.description ?? ""} placeholder="Description" onChange={(e) => set((c) => { c.blocks[ri].payload.profileChoices[i].description = e.target.value; })} />
                  <button type="button" className="btn btn--sm" disabled={p.profileChoices.length <= 2} onClick={() => set((c) => { c.blocks[ri].payload.profileChoices.splice(i, 1); })}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn--sm" onClick={() => set((c) => { c.blocks[ri].payload.profileChoices.push({ key: KEYS[c.blocks[ri].payload.profileChoices.length] ?? "X", name: "", description: "" }); })}>+ Profil</button>
            </Card>
          )}
          {tv && (
            <Card title="🎬 Vidéo déclencheur" action={<MediaPicker media={media} onPick={(m) => set((c) => { const v = c.blocks[ri].payload.triggerVideo; v.mediaId = m.id; if (m.durationSec) v.durationSec = m.durationSec; if (!v.title || v.title === "Vidéo") v.title = m.filename ?? v.title; })} />}>
              <div className="row between"><span className="muted" style={{ fontSize: 12 }}>{tv.mediaId ? `Liée : ${media.find((m) => m.id === tv.mediaId)?.filename ?? tv.mediaId}` : "Aucune vidéo liée"}</span>{tv.mediaId && <button className="btn btn--sm" onClick={() => set((c) => { c.blocks[ri].payload.triggerVideo.mediaId = undefined; })}>Délier</button>}</div>
              <div className="row" style={{ gap: 10 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Titre</label><input style={field} value={tv.title ?? ""} onChange={(e) => set((c) => { c.blocks[ri].payload.triggerVideo.title = e.target.value; })} /></div>
                <div style={{ width: 120 }}><label style={lbl}>Durée (sec)</label><input style={field} type="number" min={1} value={tv.durationSec ?? 0} onChange={(e) => set((c) => { c.blocks[ri].payload.triggerVideo.durationSec = Number(e.target.value); })} /></div>
              </div>
              <div><label style={lbl}>Message clé</label><input style={field} value={tv.keyMessage ?? ""} onChange={(e) => set((c) => { c.blocks[ri].payload.triggerVideo.keyMessage = e.target.value; })} /></div>
            </Card>
          )}
          {p.triggerQuiz && <Card title="Quiz déclencheur (non noté)"><TriggerQuestions questions={p.triggerQuiz.questions} path={(c) => c.blocks[ri].payload.triggerQuiz.questions} set={set} /></Card>}
        </>
      )}

      {/* ---- Bloc 1 ---- */}
      {block.type === "COMPREHENSION" && (
        <>
          {p.diagnosticQuiz && <Card title="Quiz diagnostique (noté)"><ScoredQuestions questions={p.diagnosticQuiz.questions} path={(c) => c.blocks[ri].payload.diagnosticQuiz.questions} set={set} /></Card>}
        </>
      )}

      {/* ---- micro-sessions (Blocs 1–3) ---- */}
      {["COMPREHENSION", "PRACTICE", "ANCHORING"].includes(block.type) && (
        <>
          {sessions.map((s, si) => (
            <div key={si} {...sdnd.row(si)} style={{ borderRadius: 12, outline: sdnd.over === si ? "2px solid var(--orange-400)" : "none" }}>
              <SessionCard s={s} si={si} total={sessions.length} ri={ri} media={media} set={set} handleProps={sdnd.handleProps(si)} />
            </div>
          ))}
          <button className="btn btn--primary" style={{ alignSelf: "flex-start" }} onClick={addSession}>+ Ajouter une micro-session</button>
        </>
      )}

      {/* ---- Bloc 1 case study ---- */}
      {block.type === "COMPREHENSION" && (
        p.caseStudy
          ? <Card title="Étude de cas" action={<button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => set((c) => { delete c.blocks[ri].payload.caseStudy; })}>Retirer</button>}>
              <div><label style={lbl}>Titre</label><input style={field} value={p.caseStudy.title ?? ""} onChange={(e) => set((c) => { c.blocks[ri].payload.caseStudy.title = e.target.value; })} /></div>
              <div><label style={lbl}>Étapes</label><StringList items={p.caseStudy.steps ?? []} path={(c) => c.blocks[ri].payload.caseStudy.steps} set={set} ph="Étape" /></div>
            </Card>
          : <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => set((c) => { c.blocks[ri].payload.caseStudy = { title: "Étude de cas", steps: [""] }; })}>+ Ajouter une étude de cas</button>
      )}

      {/* ---- Bloc 2 ---- */}
      {block.type === "PRACTICE" && (
        <>
          <Card title="Mises en situation guidées"><GuidedScenarios scenarios={p.guidedScenarios ?? []} ri={ri} set={set} /></Card>
          {p.interBlockQuiz
            ? <Card title="Quiz interbloc (non noté)" action={<button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => set((c) => { delete c.blocks[ri].payload.interBlockQuiz; })}>Retirer</button>}>
                <div><label style={lbl}>Titre</label><input style={field} value={p.interBlockQuiz.title ?? ""} onChange={(e) => set((c) => { c.blocks[ri].payload.interBlockQuiz.title = e.target.value; })} /></div>
                <ScoredQuestions questions={p.interBlockQuiz.questions} path={(c) => c.blocks[ri].payload.interBlockQuiz.questions} set={set} />
              </Card>
            : <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => set((c) => { c.blocks[ri].payload.interBlockQuiz = { title: "Quiz interbloc", scored: false, questions: [newSQ(1)] }; })}>+ Ajouter un quiz interbloc</button>}
          {p.fieldApplication && (
            <Card title="Application terrain">
              <div><label style={lbl}>Consigne ({"{{moment_ancrage}}"} autorisé)</label><textarea style={{ ...field, minHeight: 46 }} value={p.fieldApplication.brief ?? ""} onChange={(e) => set((c) => { c.blocks[ri].payload.fieldApplication.brief = e.target.value; })} /></div>
              <div className="row" style={{ gap: 14, alignItems: "center" }}>
                <div style={{ width: 140 }}><label style={lbl}>Min. caractères</label><input style={field} type="number" min={1} value={p.fieldApplication.minChars ?? 200} onChange={(e) => set((c) => { c.blocks[ri].payload.fieldApplication.minChars = Number(e.target.value); })} /></div>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, marginTop: 16 }}><input type="checkbox" checked={!!p.fieldApplication.gatesNextBlock} onChange={(e) => set((c) => { c.blocks[ri].payload.fieldApplication.gatesNextBlock = e.target.checked; })} /> Verrouille le bloc suivant</label>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ---- Bloc 3 ---- */}
      {block.type === "ANCHORING" && (
        <>
          {p.finalQuiz && <Card title="Quiz final (noté)" action={<span className="pill pill--soft">Seuil {p.finalQuiz.passThreshold ?? "?"}%</span>}>
            <div style={{ width: 200 }}><label style={lbl}>Seuil de réussite (%)</label><input style={field} type="number" min={0} max={100} value={p.finalQuiz.passThreshold ?? 0} onChange={(e) => set((c) => { c.blocks[ri].payload.finalQuiz.passThreshold = Number(e.target.value); })} /></div>
            <ScoredQuestions questions={p.finalQuiz.questions} path={(c) => c.blocks[ri].payload.finalQuiz.questions} set={set} />
          </Card>}
          {p.selfAssessment && (
            <Card title="Auto-évaluation">
              <div><label style={lbl}>Critères</label><StringList items={p.selfAssessment.criteria ?? []} path={(c) => c.blocks[ri].payload.selfAssessment.criteria} set={set} ph="Critère" /></div>
              <div><label style={lbl}>Échelle</label><StringList items={p.selfAssessment.scale ?? []} path={(c) => c.blocks[ri].payload.selfAssessment.scale} set={set} ph="Niveau" /></div>
            </Card>
          )}
          {p.actionPlan30d && (
            <Card title="Plan d'action 30 jours">
              {(p.actionPlan30d.habits ?? []).map((h: any, i: number) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
                  <div className="row between"><b style={{ fontSize: 12.5 }}>Habitude {i + 1}</b><button type="button" className="btn btn--sm" onClick={() => set((c) => { c.blocks[ri].payload.actionPlan30d.habits.splice(i, 1); })}>✕</button></div>
                  <input style={{ ...field, margin: "6px 0" }} value={h.title ?? ""} placeholder="Titre de l'habitude" onChange={(e) => set((c) => { c.blocks[ri].payload.actionPlan30d.habits[i].title = e.target.value; })} />
                  <label style={lbl}>Champs</label><StringList items={h.fields ?? []} path={(c) => c.blocks[ri].payload.actionPlan30d.habits[i].fields} set={set} ph="Champ" />
                </div>
              ))}
              <button type="button" className="btn btn--sm" onClick={() => set((c) => { (c.blocks[ri].payload.actionPlan30d.habits ??= []).push({ title: "", fields: [""] }); })}>+ Habitude</button>
            </Card>
          )}
        </>
      )}

      {/* ---- Bloc 4 ---- */}
      {block.type === "CERTIFICATION" && (
        <>
          <Card title="Projet certifiant">
            <div><label style={lbl}>Brief du projet ({"{{moment_ancrage}}"} autorisé)</label><textarea style={{ ...field, minHeight: 60 }} value={p.projectBrief ?? ""} onChange={(e) => set((c) => { c.blocks[ri].payload.projectBrief = e.target.value; })} /></div>
          </Card>
          {p.sections && (
            <Card title="Sections du projet (5)">
              {p.sections.map((s: any, i: number) => (
                <div key={i} className="row" style={{ gap: 8 }}>
                  <input style={{ ...field, flex: 1 }} value={s.title ?? ""} placeholder={`Section ${i + 1}`} onChange={(e) => set((c) => { c.blocks[ri].payload.sections[i].title = e.target.value; })} />
                  <input style={{ ...field, flex: 2 }} value={s.helpText ?? ""} placeholder="Aide" onChange={(e) => set((c) => { c.blocks[ri].payload.sections[i].helpText = e.target.value; })} />
                </div>
              ))}
            </Card>
          )}
          {p.journal?.entries && (
            <Card title="Journal (6 entrées J+1 → J+14)">
              {p.journal.entries.map((e: any, i: number) => (
                <div key={i} className="row" style={{ gap: 8, alignItems: "center" }}>
                  <span className="pill pill--navy" style={{ width: 56, textAlign: "center" }}>J+{e.day}</span>
                  <input style={{ ...field, flex: 1 }} value={e.prompt ?? ""} placeholder="Consigne du jour" onChange={(ev) => set((c) => { c.blocks[ri].payload.journal.entries[i].prompt = ev.target.value; })} />
                  <div style={{ width: 110 }}><input style={field} type="number" min={1} value={e.minWords ?? 50} onChange={(ev) => set((c) => { c.blocks[ri].payload.journal.entries[i].minWords = Number(ev.target.value); })} title="mots min." /></div>
                </div>
              ))}
              <span className="muted" style={{ fontSize: 11.5 }}>La grille d'évaluation (critères + poids) reste dans l'onglet « Formulaire ».</span>
            </Card>
          )}
        </>
      )}
    </div>
  );
}


export function ContentEditor({ content, set, blockNotes, onClearNote }: { content: Content; set: Set; blockNotes?: Record<number, string>; onClearNote?: (index: number) => void }) {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [bi, setBi] = useState(0);
  useEffect(() => { api.media().then(setMedia).catch(() => {}); }, []);

  const blocks = content.blocks ?? [];
  if (blocks.length === 0) return <div className="card"><div className="card-b">Aucun bloc.</div></div>;
  const block = blocks[Math.min(bi, blocks.length - 1)];
  const ri = content.blocks.findIndex((b) => b.index === block.index);

  const totals = counts(blocks.flatMap((b: any) => b.units ?? []));
  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-b row between" style={{ paddingTop: 12, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-1)" }}>Total auditable du parcours</span>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="pill pill--green">{totals.ms} micro-sessions</span>
            <span className="pill pill--warn">{totals.la} activités longues</span>
            <span className="pill pill--soft">{totals.mt} micro-tâches</span>
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {blocks.map((b, i) => <button key={b.index} className={`btn btn--sm ${i === bi ? "btn--primary" : ""}`} onClick={() => setBi(i)} title={b.title}>Bloc {b.index} · {b.title || TYPE_FR[b.type] || b.type}</button>)}
      </div>
      <BlockEditor block={block} ri={ri} media={media} set={set} note={blockNotes?.[block.index]} onClearNote={onClearNote ? () => onClearNote(block.index) : undefined} />
    </div>
  );
}
