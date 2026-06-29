import { useEffect, useState } from "react";
import { api, type BankQuestion } from "../lib/api";

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
export function QuestionBank() {
  const [rows, setRows] = useState<BankQuestion[] | null>(null);
  const [subAreas, setSubAreas] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    try { setRows(await api.bankQuestions(filter || undefined)); } catch { setRows([]); }
    try { setSubAreas(await api.bankSubAreas()); } catch { /* */ }
  }
  useEffect(() => { void load(); }, [filter]);

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette question de la banque ?")) return;
    try { await api.deleteBankQuestion(id); setNote("🗑️ Question supprimée."); load(); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{rows ? `${rows.length} question${rows.length > 1 ? "s" : ""}` : "…"}</div>
          <h1>Banque de questions</h1>
          <div className="sub">Questions réutilisables. Ajoutez-les depuis l'éditeur de cours (« ➕ Banque »), puis insérez-les dans n'importe quel quiz.</div>
        </div>
        <div className="filters">
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tous les sous-domaines</option>
            {subAreas.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
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
                  <div className="row" style={{ gap: 6, marginBottom: 3 }}>
                    <span className="pill pill--soft" style={{ fontSize: 11 }}>{TYPE_LABEL[r.question.type ?? "single"] ?? r.question.type}</span>
                    {r.subArea && <span className="pill pill--info" style={{ fontSize: 11 }}>{r.subArea}</span>}
                  </div>
                  <b style={{ fontSize: 13.5 }}>{r.question.scenarioText}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{summary(r.question)}</div>
                </div>
                <button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => remove(r.id)} title="Supprimer de la banque">🗑️</button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
