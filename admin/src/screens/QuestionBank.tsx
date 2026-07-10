import { useEffect, useState } from "react";
import { api, type BankQuestion, type CourseSummary } from "../lib/api";

const TYPE_LABEL: Record<string, string> = { single: "QCM", multiple: "Choix multiples", truefalse: "Vrai/Faux", numeric: "Numérique", short: "Réponse courte" };

function summary(q: any): string {
  switch (q.type ?? "single") {
    case "multiple": return `Bonnes réponses : ${(q.correctKeys ?? []).join(", ")}`;
    case "truefalse": return `Réponse : ${q.correctBool ? "Vrai" : "Faux"}`;
    case "numeric": return `Réponse : ${q.answerNumber}${q.tolerance ? ` ± ${q.tolerance}` : ""}`;
    case "short": return `Acceptées : ${(q.accepted ?? []).join(", ")}`;
    default: return `Bonne réponse : ${q.correctKey}`;
  }
}

/** Reusable question bank — browse / filter / delete. Questions are added to the
 *  bank from the course editor ("➕ Banque") and inserted back from there. */
const ORIGIN_LABEL: Record<string, string> = { manual: "manuelle", course: "parcours", ai: "variante IA" };

export function QuestionBank() {
  const [rows, setRows] = useState<BankQuestion[] | null>(null);
  const [subAreas, setSubAreas] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" | "pending" | "approved"
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [importCourse, setImportCourse] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    try { setRows(await api.bankQuestions(filter || undefined, statusFilter || undefined)); } catch { setRows([]); }
    try { setSubAreas(await api.bankSubAreas()); } catch { /* */ }
  }
  useEffect(() => { void load(); }, [filter, statusFilter]);
  useEffect(() => { api.courses().then(setCourses).catch(() => {}); }, []);

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette question de la banque ?")) return;
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
          <div className="eyebrow">{rows ? `${rows.length} question${rows.length > 1 ? "s" : ""}` : "…"}</div>
          <h1>Banque de questions</h1>
          <div className="sub">Questions réutilisables. Ajoutez-les depuis l'éditeur de cours (« ➕ Banque »), puis insérez-les dans n'importe quel quiz.</div>
        </div>
        <div className="filters" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
        </div>
      </div>

      {note && <div className="card" style={{ background: note.startsWith("🗑️") ? "var(--success-tint)" : "var(--warning-tint)", border: "none", padding: "11px 14px", marginBottom: 14, fontSize: 13 }} onClick={() => setNote(null)}>{note}</div>}

      <div className="card">
        <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {!rows ? <div className="empty">Chargement…</div>
            : rows.length === 0 ? <div className="empty"><div className="big">🗂️</div>Banque vide. Dans l'éditeur de cours, cliquez « ➕ Banque » sur une question pour l'y ajouter.</div>
            : rows.map((r, i) => (
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
                  <button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => remove(r.id)} title={r.status === "pending" ? "Rejeter (supprime la proposition)" : "Supprimer de la banque"}>{r.status === "pending" ? "✖ Rejeter" : "🗑️"}</button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
