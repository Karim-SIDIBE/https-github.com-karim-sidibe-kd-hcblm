import { useEffect, useState } from "react";
import { api, type ReportSchedule } from "../lib/api";
import { ago } from "../lib/ui";

const FREQ_FR: Record<string, string> = { WEEKLY: "Hebdomadaire", MONTHLY: "Mensuel" };

/** Manage scheduled e-mail delivery of the course report (P3 brick 4). */
export function ScheduledReports({ courseId }: { courseId: string }) {
  const [rows, setRows] = useState<ReportSchedule[] | null>(null);
  const [emails, setEmails] = useState("");
  const [freq, setFreq] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function load() { try { setRows(await api.reportSchedules(courseId)); } catch { setRows([]); } }
  useEffect(() => { void load(); }, [courseId]);

  async function add() {
    const recipients = emails.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
    if (!recipients.length) { setNote("Indiquez au moins une adresse e-mail."); return; }
    setBusy(true); setNote(null);
    try { await api.createReportSchedule({ courseId, recipients, frequency: freq, format }); setEmails(""); setNote("✅ Programmation enregistrée."); load(); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette programmation ?")) return;
    try { await api.deleteReportSchedule(id); load(); } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h"><h3>Rapports programmés par e-mail</h3>{rows && <span className="pill pill--soft">{rows.length}</span>}</div>
      <div className="card-b" style={{ paddingTop: 6 }}>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>Recevez automatiquement le rapport du parcours (Excel ou CSV) par e-mail, chaque semaine ou chaque mois.</div>

        {note && <div style={{ background: note.startsWith("✅") ? "var(--success-tint)" : "var(--warning-tint)", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12.5 }} onClick={() => setNote(null)}>{note}</div>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input className="field" style={{ flex: "1 1 280px", minWidth: 220 }} placeholder="Destinataires (e-mails séparés par des virgules)" value={emails} onChange={(e) => setEmails(e.target.value)} />
          <select className="select" value={freq} onChange={(e) => setFreq(e.target.value as "WEEKLY" | "MONTHLY")}><option value="WEEKLY">Hebdomadaire</option><option value="MONTHLY">Mensuel</option></select>
          <select className="select" value={format} onChange={(e) => setFormat(e.target.value as "xlsx" | "csv")}><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV</option></select>
          <button className="btn btn--primary" disabled={busy} onClick={add}>{busy ? "…" : "Programmer"}</button>
        </div>

        {!rows ? <div className="muted">Chargement…</div>
          : rows.length === 0 ? <div className="muted" style={{ fontSize: 12.5 }}>Aucune programmation. Ajoutez des destinataires ci-dessus.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((s) => (
                <div key={s.id} className="row between" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                  <div>
                    <b>{FREQ_FR[s.frequency] ?? s.frequency}</b> · {s.format.toUpperCase()} · {s.recipients.join(", ")}
                    <div className="muted" style={{ fontSize: 11.5 }}>{s.lastSentAt ? `Dernier envoi ${ago(s.lastSentAt)}` : "Jamais envoyé encore"}</div>
                  </div>
                  <button className="btn btn--sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => remove(s.id)} title="Supprimer">🗑️</button>
                </div>
              ))}
            </div>}
      </div>
    </div>
  );
}
