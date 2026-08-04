import { useRef, useState } from "react";
import { api, courseTitle, ApiError, type ImportReport } from "../lib/api";
import { genPassword } from "../lib/ui";
import { downloadCsv, table, today, type Col } from "../lib/csv";
import type { CourseCtx } from "../App";

const field: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 9, fontFamily: "inherit", fontSize: 13.5 };
const lbl: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--fg-1)", margin: "0 0 6px" };

type RowResult = { name: string; email: string; password: string; status: "ok" | "exists" | "error"; detail?: string; invited?: boolean };

async function createAndEnrol(name: string, email: string, password: string, courseId: string, invite: boolean): Promise<RowResult> {
  try {
    const u = await api.createUser({ name, email, password, role: "LEARNER" });
    await api.enroll(u.id, courseId);
    let invited = false;
    if (invite) { try { const inv = await api.invite(u.id, password); invited = inv.delivered; } catch { /* delivery best-effort */ } }
    return { name, email, password, status: "ok", invited };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return { name, email, password, status: "exists", detail: "E-mail déjà existant" };
    return { name, email, password, status: "error", detail: e instanceof Error ? e.message : "Erreur" };
  }
}

/** Parse pasted text or a CSV file: `Nom, Email[, Rôle]` per line; separators
 *  `,` `;` tab; a header row (nom/name…) is detected and skipped; simple
 *  quoted fields are unwrapped. */
function parseRows(text: string): { name: string; email: string; role?: string }[] {
  const unquote = (s: string) => s.trim().replace(/^"(.*)"$/s, "$1").trim();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: { name: string; email: string; role?: string }[] = [];
  for (const line of lines) {
    const parts = line.split(/[;,\t]/).map(unquote);
    if (parts.length < 2) continue;
    const [name, email, role] = parts;
    if (/^(nom|name)$/i.test(name ?? "") || /^(e-?mail|courriel)$/i.test(email ?? "")) continue; // header row
    if (!email) continue;
    rows.push({ name: name || email, email, ...(role ? { role } : {}) });
  }
  return rows;
}

export function Enrol({ ctx }: { ctx: CourseCtx }) {
  const { courses, courseId } = ctx;
  const [target, setTarget] = useState(courseId);
  const [invite, setInvite] = useState(true);

  // --- single ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState(genPassword());
  const [busy, setBusy] = useState(false);
  const [single, setSingle] = useState<RowResult | null>(null);

  async function submitSingle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setSingle(null);
    const r = await createAndEnrol(name.trim(), email.trim(), pwd, target, invite);
    setSingle(r);
    if (r.status === "ok") { setName(""); setEmail(""); setPwd(genPassword()); }
    setBusy(false);
  }

  // --- bulk (M3: one server call, row-independent report) ---
  const [csv, setCsv] = useState("");
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [bulkErr, setBulkErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = parseRows(csv);

  function loadFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    void f.text().then((t) => setCsv(t));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function runBulk() {
    if (parsed.length === 0) return;
    setRunning(true); setReport(null); setBulkErr(null);
    try { setReport(await api.importUsers(parsed, { courseId: target, invite })); }
    catch (e) { setBulkErr(e instanceof Error ? e.message : "Import impossible"); }
    finally { setRunning(false); }
  }

  function downloadCreds() {
    const rows = report?.credentials ?? [];
    const cols: Col<{ email: string; password: string }>[] = [
      { label: "Email", value: (r) => r.email },
      { label: "Mot de passe", value: (r) => r.password },
    ];
    downloadCsv(`identifiants-apprenants-${today()}.csv`, table(cols, rows));
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Onboarding</div>
          <h1>Inscriptions</h1>
          <div className="sub">Créez des comptes apprenants et inscrivez-les à un parcours.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--fg-2)" }}>
            <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} /> Envoyer l'invitation
          </label>
          <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
            {courses.map((c) => <option key={c.id} value={c.id}>{courseTitle(c)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.25fr", alignItems: "start" }}>
        {/* Single */}
        <form className="card" onSubmit={submitSingle}>
          <div className="card-h"><h3>Inscrire un apprenant</h3></div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div><label style={lbl}>Nom complet</label><input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Aminata Diallo" required /></div>
            <div><label style={lbl}>E-mail</label><input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aminata.d@exemple.com" required /></div>
            <div>
              <label style={lbl}>Mot de passe initial</label>
              <div className="row" style={{ gap: 8 }}>
                <input style={{ ...field, fontFamily: "monospace" }} value={pwd} onChange={(e) => setPwd(e.target.value)} required />
                <button type="button" className="btn btn--sm" onClick={() => setPwd(genPassword())}>Générer</button>
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>À communiquer à l'apprenant pour sa première connexion.</span>
            </div>
            <button className="btn btn--primary" disabled={busy} style={{ justifyContent: "center", padding: "11px" }}>{busy ? "…" : "Créer et inscrire"}</button>
            {single && (
              <div className="card" style={{ background: single.status === "ok" ? "var(--success-tint)" : "var(--danger-tint)", border: "none", padding: "12px 14px" }}>
                {single.status === "ok"
                  ? <div style={{ fontSize: 13 }}>✅ <b>{single.name}</b> inscrit·e. Identifiants : <b>{single.email}</b> / <code style={{ fontFamily: "monospace" }}>{single.password}</code>{invite && (single.invited ? " · invitation envoyée" : " · ⚠️ invitation non délivrée (SMTP non configuré) — communiquez le mot de passe")}</div>
                  : <div style={{ fontSize: 13, color: "var(--danger)" }}>✗ {single.detail}</div>}
              </div>
            )}
          </div>
        </form>

        {/* Bulk — CSV file or pasted list, imported in ONE server call. */}
        <div className="card">
          <div className="card-h"><h3>Import CSV en masse</h3><span className="muted" style={{ fontSize: 12 }}>colonnes : <code>Nom, Email[, Rôle]</code> — en-tête optionnel</span></div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="row" style={{ gap: 8 }}>
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files)} />
              <button className="btn btn--sm" onClick={() => fileRef.current?.click()}>📄 Charger un fichier CSV…</button>
              <span className="muted" style={{ fontSize: 12 }}>ou collez la liste ci-dessous</span>
            </div>
            <textarea style={{ ...field, minHeight: 120, fontFamily: "monospace", fontSize: 12.5, resize: "vertical" }} value={csv} onChange={(e) => { setCsv(e.target.value); setReport(null); }}
              placeholder={"Nom, Email, Rôle (optionnel)\nAminata Diallo, aminata.d@orange.ci\nKouamé N'Guessan, kouame.n@orange.ci, LEARNER"} />
            <div className="row between">
              <span className="muted" style={{ fontSize: 12 }}>{parsed.length} apprenant(s) détecté(s) · mots de passe générés côté serveur · 500 max par import</span>
              <button className="btn btn--primary" disabled={running || parsed.length === 0 || parsed.length > 500} onClick={() => void runBulk()}>{running ? "Import en cours…" : `Importer${target ? " & inscrire" : ""}`}</button>
            </div>
            {bulkErr && <div className="card" style={{ background: "var(--danger-tint)", border: "none", padding: "11px 13px", fontSize: 13, color: "var(--danger)" }}>✗ {bulkErr}</div>}

            {report && (
              <div className="card" style={{ border: "1px solid var(--line)" }}>
                <div className="card-h" style={{ paddingBottom: 8, gap: 6, flexWrap: "wrap" }}>
                  <span className="pill pill--green">{report.created} créé(s)</span>
                  <span className="pill pill--soft">{report.existing} déjà existant(s)</span>
                  <span className="pill pill--info">{report.enrolled} inscrit(s) au parcours</span>
                  {invite && <span className="pill pill--soft">{report.invited} invitation(s) délivrée(s)</span>}
                  {report.errors.length > 0 && <span className="pill pill--red">{report.errors.length} erreur(s)</span>}
                  {report.credentials.length > 0 && <button className="btn btn--sm" onClick={downloadCreds}>⤓ Télécharger les identifiants</button>}
                </div>
                {report.errors.length > 0 && (
                  <div style={{ maxHeight: 180, overflow: "auto" }}>
                    <table className="table">
                      <thead><tr><th>Ligne</th><th>E-mail</th><th>Erreur</th></tr></thead>
                      <tbody>
                        {report.errors.map((e, i) => (
                          <tr key={i} style={{ cursor: "default" }}>
                            <td><span className="num">{e.line}</span></td>
                            <td><span style={{ fontSize: 12.5 }}>{e.email || "—"}</span></td>
                            <td><span style={{ fontSize: 12.5, color: "var(--danger)" }}>{e.error}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {report.credentials.length > 0 && (
                  <div style={{ maxHeight: 220, overflow: "auto" }}>
                    <table className="table">
                      <thead><tr><th>E-mail</th><th>Mot de passe initial</th></tr></thead>
                      <tbody>
                        {report.credentials.map((c) => (
                          <tr key={c.email} style={{ cursor: "default" }}>
                            <td><span style={{ fontSize: 12.5 }}>{c.email}</span></td>
                            <td><code style={{ fontFamily: "monospace", fontSize: 12 }}>{c.password}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
