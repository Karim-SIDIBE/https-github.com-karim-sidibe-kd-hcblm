import { useState } from "react";
import { api, courseTitle, ApiError } from "../lib/api";
import { genPassword } from "../lib/ui";
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

  // --- bulk ---
  const [csv, setCsv] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);

  async function runBulk() {
    const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map((l) => l.split(/[,;\t]/).map((x) => x.trim())).filter((p) => p[1]);
    setRunning(true); setResults([]);
    const out: RowResult[] = [];
    for (const [n, em] of parsed) {
      const r = await createAndEnrol(n || em, em, genPassword(), target, invite);
      out.push(r); setResults([...out]);
    }
    setRunning(false);
  }

  function downloadCreds() {
    const rows = (results ?? []).filter((r) => r.status === "ok");
    const csvOut = "Nom,Email,Mot de passe\n" + rows.map((r) => `"${r.name}","${r.email}","${r.password}"`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csvOut], { type: "text/csv" }));
    a.download = "identifiants-apprenants.csv"; a.click();
  }

  const okCount = (results ?? []).filter((r) => r.status === "ok").length;

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

        {/* Bulk */}
        <div className="card">
          <div className="card-h"><h3>Import en masse (liste)</h3><span className="muted" style={{ fontSize: 12 }}>une ligne par apprenant : <code>Nom, Email</code></span></div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <textarea style={{ ...field, minHeight: 120, fontFamily: "monospace", fontSize: 12.5, resize: "vertical" }} value={csv} onChange={(e) => setCsv(e.target.value)}
              placeholder={"Aminata Diallo, aminata.d@orange.ci\nKouamé N'Guessan, kouame.n@orange.ci"} />
            <div className="row between">
              <span className="muted" style={{ fontSize: 12 }}>{csv.split("\n").filter((l) => l.trim()).length} ligne(s) · mots de passe générés automatiquement</span>
              <button className="btn btn--primary" disabled={running || !csv.trim()} onClick={runBulk}>{running ? "Import en cours…" : "Importer & inscrire"}</button>
            </div>

            {results && (
              <div className="card" style={{ border: "1px solid var(--line)" }}>
                <div className="card-h" style={{ paddingBottom: 8 }}>
                  <span className="pill pill--green">{okCount} inscrits</span>
                  {okCount > 0 && <button className="btn btn--sm" onClick={downloadCreds}>⤓ Télécharger les identifiants</button>}
                </div>
                <div style={{ maxHeight: 260, overflow: "auto" }}>
                  <table className="table">
                    <thead><tr><th>Apprenant</th><th>Mot de passe</th><th>Statut</th></tr></thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} style={{ cursor: "default" }}>
                          <td><div className="who"><b style={{ fontSize: 13 }}>{r.name}</b><span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{r.email}</span></div></td>
                          <td><code style={{ fontFamily: "monospace", fontSize: 12 }}>{r.status === "ok" ? r.password : "—"}</code></td>
                          <td>{r.status === "ok" ? <span className="pill pill--green">Inscrit</span> : r.status === "exists" ? <span className="pill pill--warn">Existe déjà</span> : <span className="pill pill--red" title={r.detail}>Erreur</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
