import { useEffect, useMemo, useState } from "react";
import { api, type BankQuestion, type CourseSummary } from "../lib/api";
import { modal } from "../lib/modal";

const TYPE_LABEL: Record<string, string> = { single: "QCM", multiple: "Choix multiples", truefalse: "Vrai/Faux", numeric: "Numérique", short: "Réponse courte" };
const KEYS = ["A", "B", "C", "D"] as const;

function summary(q: any): string {
  switch (q.type ?? "single") {
    case "multiple": return `Bonnes réponses : ${(q.correctKeys ?? []).join(", ")}`;
    case "truefalse": return `Réponse : ${q.correctBool ? "Vrai" : "Faux"}`;
    case "numeric": return `Réponse : ${q.answerNumber}${q.tolerance ? ` ± ${q.tolerance}` : ""}`;
    case "short": return `Acceptées : ${(q.accepted ?? []).join(", ")}`;
    default: return `Bonne réponse : ${q.correctKey}`;
  }
}

/** Editable form state — row-indexed correctness so gaps in the A–D inputs
 *  never desynchronise the checked answer from its letter (re-keyed on save). */
type Draft = {
  type: string;
  scenarioText: string;
  feedbackText: string;
  subArea: string;
  level: string;
  labels: string[]; // A–D option labels (empty = unused)
  correctRow: number; // single
  correctRows: boolean[]; // multiple
  correctBool: boolean; // truefalse
  answerNumber: string; // numeric
  tolerance: string; // numeric
  accepted: string; // short — one accepted answer per line
};

const EMPTY_DRAFT: Draft = {
  type: "single", scenarioText: "", feedbackText: "", subArea: "", level: "",
  labels: ["", "", "", ""], correctRow: 0, correctRows: [false, false, false, false],
  correctBool: true, answerNumber: "", tolerance: "", accepted: "",
};

function draftFrom(r: BankQuestion): Draft {
  const q = r.question ?? {};
  const opts: { key: string; label: string }[] = q.options ?? [];
  const labels = ["", "", "", ""];
  opts.slice(0, 4).forEach((o, i) => { labels[i] = o.label; });
  const keyRow = (k: string) => Math.max(0, opts.findIndex((o) => o.key === k));
  return {
    type: q.type ?? "single",
    scenarioText: q.scenarioText ?? "",
    feedbackText: q.feedbackText ?? "",
    subArea: r.subArea ?? "",
    level: r.level ?? "",
    labels,
    correctRow: q.correctKey ? keyRow(q.correctKey) : 0,
    correctRows: [0, 1, 2, 3].map((i) => !!opts[i] && (q.correctKeys ?? []).includes(opts[i].key)),
    correctBool: q.correctBool !== false,
    answerNumber: q.answerNumber != null ? String(q.answerNumber) : "",
    tolerance: q.tolerance != null ? String(q.tolerance) : "",
    accepted: (q.accepted ?? []).join("\n"),
  };
}

/** Build the ScoredQuestion payload from the draft (re-keys options A→D in
 *  filled order). Returns a French error instead when the draft is incomplete. */
function toQuestion(d: Draft, existingId?: string): { question?: any; error?: string } {
  if (!d.scenarioText.trim()) return { error: "Le scénario (énoncé) est requis." };
  if (!d.feedbackText.trim()) return { error: "Le feedback (explication montrée après réponse) est requis." };
  const q: any = {
    id: existingId || `bank-${Math.random().toString(36).slice(2, 10)}`,
    type: d.type,
    scenarioText: d.scenarioText.trim(),
    feedbackText: d.feedbackText.trim(),
  };
  if (d.subArea.trim()) q.subArea = d.subArea.trim();
  if (d.type === "single" || d.type === "multiple") {
    const rows = [0, 1, 2, 3].filter((i) => d.labels[i].trim() !== "");
    if (rows.length < 2) return { error: "Au moins 2 options sont requises." };
    q.options = rows.map((r, i) => ({ key: KEYS[i], label: d.labels[r].trim() }));
    if (d.type === "single") {
      const at = rows.indexOf(d.correctRow);
      if (at < 0) return { error: "Cochez la bonne réponse (elle doit avoir un intitulé)." };
      q.correctKey = KEYS[at];
    } else {
      const keys = rows.filter((r) => d.correctRows[r]).map((r) => KEYS[rows.indexOf(r)]);
      if (keys.length === 0) return { error: "Cochez au moins une bonne réponse." };
      q.correctKeys = keys;
    }
  } else if (d.type === "truefalse") {
    q.correctBool = d.correctBool;
  } else if (d.type === "numeric") {
    const n = Number(d.answerNumber);
    if (d.answerNumber.trim() === "" || !Number.isFinite(n)) return { error: "Une réponse numérique est requise." };
    q.answerNumber = n;
    const t = Number(d.tolerance);
    if (d.tolerance.trim() !== "" && Number.isFinite(t) && t >= 0) q.tolerance = t;
  } else if (d.type === "short") {
    const accepted = d.accepted.split("\n").map((s) => s.trim()).filter(Boolean);
    if (accepted.length === 0) return { error: "Indiquez au moins une réponse acceptée (une par ligne)." };
    q.accepted = accepted;
  }
  return { question: q };
}

function QuestionForm({ initial, editing, subAreas, onSaved, onClose }: {
  initial: Draft; editing: BankQuestion | null; subAreas: string[];
  onSaved: (msg: string) => void; onClose: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  const editId = editing?.question?.id as string | undefined;

  async function save() {
    const built = toQuestion(d, editId);
    if (!built.question) { setErr(built.error ?? "Formulaire incomplet."); return; }
    if (editing?.question?.profiling) built.question.profiling = true; // preserved: not editable here
    setBusy(true); setErr(null);
    try {
      if (editing) {
        await api.updateBankQuestion(editing.id, { question: built.question, subArea: d.subArea.trim(), level: d.level.trim() });
        onSaved("✏️ Question mise à jour.");
      } else {
        await api.addBankQuestion({ question: built.question, subArea: d.subArea.trim() || undefined, level: d.level.trim() || undefined });
        onSaved("➕ Question ajoutée à la banque.");
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur d'enregistrement"); }
    finally { setBusy(false); }
  }

  const inp = { border: "1px solid var(--line-strong)", borderRadius: 8, padding: "8px 10px", fontFamily: "inherit", fontSize: 13 } as const;
  const lbl = { fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" as const, letterSpacing: 0.4, marginBottom: 4, display: "block" };

  return (
    <div className="card" style={{ marginBottom: 14, border: "1px solid var(--navy-200, var(--line-strong))" }}>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="row between">
          <b style={{ fontSize: 14 }}>{editing ? "Modifier la question" : "Nouvelle question"}</b>
          <button className="x" onClick={onClose}>×</button>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div>
            <span style={lbl}>Type</span>
            <select className="select" value={d.type} onChange={(e) => set({ type: e.target.value })}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <span style={lbl}>Sous-domaine</span>
            <input style={{ ...inp, width: "100%" }} list="kd-subareas" value={d.subArea} onChange={(e) => set({ subArea: e.target.value })} placeholder="ex. Priorisation" />
            <datalist id="kd-subareas">{subAreas.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div style={{ width: 90 }}>
            <span style={lbl}>Niveau</span>
            <input style={{ ...inp, width: "100%" }} value={d.level} onChange={(e) => set({ level: e.target.value })} placeholder="ex. 1" />
          </div>
        </div>

        <div>
          <span style={lbl}>Scénario / énoncé</span>
          <textarea style={{ ...inp, width: "100%", minHeight: 64, resize: "vertical" }} value={d.scenarioText} onChange={(e) => set({ scenarioText: e.target.value })} placeholder="Situation professionnelle + question posée à l'apprenant…" />
        </div>

        {(d.type === "single" || d.type === "multiple") && (
          <div>
            <span style={lbl}>Options (2 à 4) — {d.type === "single" ? "cochez la bonne réponse" : "cochez les bonnes réponses"}</span>
            {KEYS.map((k, i) => (
              <div className="row" key={k} style={{ gap: 8, marginBottom: 6 }}>
                <input type={d.type === "single" ? "radio" : "checkbox"} name="correct"
                  checked={d.type === "single" ? d.correctRow === i : d.correctRows[i]}
                  onChange={(e) => d.type === "single" ? set({ correctRow: i }) : set({ correctRows: d.correctRows.map((v, j) => j === i ? e.target.checked : v) })} />
                <span style={{ width: 18, fontWeight: 700, fontSize: 12.5 }}>{k}</span>
                <input style={{ ...inp, flex: 1 }} value={d.labels[i]} placeholder={i < 2 ? "Intitulé (requis)" : "Intitulé (optionnel)"}
                  onChange={(e) => set({ labels: d.labels.map((v, j) => j === i ? e.target.value : v) })} />
              </div>
            ))}
          </div>
        )}
        {d.type === "truefalse" && (
          <div>
            <span style={lbl}>Bonne réponse</span>
            <div className="row" style={{ gap: 14 }}>
              <label className="row" style={{ gap: 6 }}><input type="radio" checked={d.correctBool} onChange={() => set({ correctBool: true })} /> Vrai</label>
              <label className="row" style={{ gap: 6 }}><input type="radio" checked={!d.correctBool} onChange={() => set({ correctBool: false })} /> Faux</label>
            </div>
          </div>
        )}
        {d.type === "numeric" && (
          <div className="row" style={{ gap: 10 }}>
            <div><span style={lbl}>Réponse attendue</span><input style={{ ...inp, width: 140 }} type="number" value={d.answerNumber} onChange={(e) => set({ answerNumber: e.target.value })} /></div>
            <div><span style={lbl}>Tolérance ±</span><input style={{ ...inp, width: 110 }} type="number" min={0} value={d.tolerance} onChange={(e) => set({ tolerance: e.target.value })} placeholder="0" /></div>
          </div>
        )}
        {d.type === "short" && (
          <div>
            <span style={lbl}>Réponses acceptées (une par ligne, insensible à la casse)</span>
            <textarea style={{ ...inp, width: "100%", minHeight: 56, resize: "vertical" }} value={d.accepted} onChange={(e) => set({ accepted: e.target.value })} placeholder={"pomodoro\nméthode pomodoro"} />
          </div>
        )}

        <div>
          <span style={lbl}>Feedback (explication montrée après la réponse)</span>
          <textarea style={{ ...inp, width: "100%", minHeight: 56, resize: "vertical" }} value={d.feedbackText} onChange={(e) => set({ feedbackText: e.target.value })} placeholder="Pourquoi cette réponse est la bonne, et le principe à retenir…" />
        </div>

        {err && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>{err}</div>}
        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--primary" disabled={busy} onClick={save}>{busy ? "…" : editing ? "Enregistrer les modifications" : "Ajouter à la banque"}</button>
        </div>
      </div>
    </div>
  );
}

/** Reusable question bank — browse / search / create / edit / validate / delete.
 *  Questions also arrive from the course editor ("➕ Banque") and course imports. */
const ORIGIN_LABEL: Record<string, string> = { manual: "manuelle", course: "parcours", ai: "variante IA" };

export function QuestionBank() {
  const [rows, setRows] = useState<BankQuestion[] | null>(null);
  const [subAreas, setSubAreas] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" | "pending" | "approved"
  const [q, setQ] = useState(""); // client-side full-text search
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [importCourse, setImportCourse] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [form, setForm] = useState<{ initial: Draft; editing: BankQuestion | null } | null>(null);

  async function load() {
    try { setRows(await api.bankQuestions(filter || undefined, statusFilter || undefined)); } catch { setRows([]); }
    try { setSubAreas(await api.bankSubAreas()); } catch { /* */ }
  }
  useEffect(() => { void load(); }, [filter, statusFilter]);
  useEffect(() => { api.courses().then(setCourses).catch(() => {}); }, []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows ?? [];
    return (rows ?? []).filter((r) =>
      (`${r.subArea} ${r.level} ${JSON.stringify(r.question)}`).toLowerCase().includes(needle));
  }, [rows, q]);

  async function remove(id: string) {
    if (!(await modal.confirm({ title: "Supprimer cette question de la banque ?", danger: true, okLabel: "Supprimer" }))) return;
    try { await api.deleteBankQuestion(id); setNote("🗑️ Question supprimée."); load(); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
  }

  async function approve(id: string) {
    try { await api.approveBankQuestion(id); setNote("✅ Question validée — utilisable par les tirages."); load(); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
  }

  async function importFromCourse() {
    if (!importCourse) return;
    try {
      const r = await api.importBankFromCourse(importCourse);
      setNote(`📥 Import terminé : ${r.created} nouvelle(s), ${r.updated} mise(s) à jour (sur ${r.total} questions du parcours).`);
      load();
    } catch (e) { setNote(e instanceof Error ? e.message : "Import impossible (le parcours doit être publié)"); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{rows ? `${visible.length}${q ? ` / ${rows.length}` : ""} question${(q ? visible.length : rows.length) > 1 ? "s" : ""}` : "…"}</div>
          <h1>Banque de questions</h1>
          <div className="sub">Questions réutilisables : créez-les ici, importez-les d'un parcours publié, puis insérez-les dans n'importe quel quiz.</div>
        </div>
        <div className="filters" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input className="select" style={{ width: 180 }} placeholder="🔎 Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} title="Recherche plein texte : énoncé, options, feedback, sous-domaine" />
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} title="Filtrer par statut de validation">
            <option value="">Tous statuts</option>
            <option value="pending">🕒 À valider</option>
            <option value="approved">✅ Validées</option>
          </select>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tous les sous-domaines</option>
            {subAreas.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select" value={importCourse} onChange={(e) => setImportCourse(e.target.value)} title="Importer toutes les questions notées d'un parcours publié">
            <option value="">Importer depuis un parcours…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.versions.find((v) => v.status === "PUBLISHED")?.title ?? c.versions[0]?.title ?? c.slug}</option>)}
          </select>
          <button className="btn btn--sm" disabled={!importCourse} onClick={importFromCourse}>📥 Importer</button>
          <button className="btn btn--sm btn--primary" onClick={() => setForm({ initial: EMPTY_DRAFT, editing: null })}>+ Nouvelle question</button>
        </div>
      </div>

      {note && <div className="card" style={{ background: note.startsWith("🗑️") ? "var(--success-tint)" : "var(--warning-tint)", border: "none", padding: "11px 14px", marginBottom: 14, fontSize: 13 }} onClick={() => setNote(null)}>{note}</div>}

      {form && (
        <QuestionForm key={form.editing?.id ?? "new"} initial={form.initial} editing={form.editing} subAreas={subAreas}
          onSaved={(msg) => { setForm(null); setNote(msg); load(); }} onClose={() => setForm(null)} />
      )}

      <div className="card">
        <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {!rows ? <div className="empty">Chargement…</div>
            : visible.length === 0 ? <div className="empty"><div className="big">🗂️</div>{q ? "Aucune question ne correspond à cette recherche." : "Banque vide. Créez une question avec « + Nouvelle question » ou importez-les depuis un parcours publié."}</div>
            : visible.map((r, i) => (
              <div key={r.id} className="row between" style={{ padding: "11px 2px", borderTop: i ? "1px solid var(--line)" : "none", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                    <span className="pill pill--soft" style={{ fontSize: 11 }}>{TYPE_LABEL[r.question.type ?? "single"] ?? r.question.type}</span>
                    {r.subArea && <span className="pill pill--info" style={{ fontSize: 11 }}>{r.subArea}</span>}
                    {r.status === "pending" && <span className="pill pill--warn" style={{ fontSize: 11 }}>🕒 À valider</span>}
                    {r.origin !== "manual" && <span className="pill pill--soft" style={{ fontSize: 11 }}>{ORIGIN_LABEL[r.origin] ?? r.origin}{r.origin === "ai" && r.note ? ` · ${r.note}` : ""}</span>}
                  </div>
                  <b style={{ fontSize: 13.5 }}>{r.question.scenarioText}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{summary(r.question)}</div>
                </div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  {r.status === "pending" && <button className="btn btn--sm btn--primary" onClick={() => approve(r.id)} title="Valider : la question devient utilisable par les tirages">✔ Valider</button>}
                  <button className="btn btn--sm" onClick={() => setForm({ initial: draftFrom(r), editing: r })} title="Modifier la question">✎ Modifier</button>
                  <button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => remove(r.id)} title={r.status === "pending" ? "Rejeter (supprime la proposition)" : "Supprimer de la banque"}>{r.status === "pending" ? "✖ Rejeter" : "🗑️"}</button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
