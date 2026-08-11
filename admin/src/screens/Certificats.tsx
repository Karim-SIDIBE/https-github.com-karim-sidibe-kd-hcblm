import { useEffect, useState } from "react";
import { api, type CredentialRow } from "../lib/api";
import { downloadBlob } from "../lib/csv";
import { avatarColor, initials, ago } from "../lib/ui";
import { Pager, ViewsBar } from "../lib/widgets";
import { modal } from "../lib/modal";

const PAGE_SIZE = 25;

/** Jalons de fin de bloc : des BADGES — seul le titre de fin de parcours
 *  (achievementType CERTIFICATE) est un certificat. */
const BADGE_FR: Record<string, string> = {
  ENTRY: "Entrée", COMPREHENSION: "Compréhension", PRACTICE: "Pratique", ANCHORING: "Ancrage", CERTIFICATE: "Certificat",
};

export function Certificats() {
  const [rows, setRows] = useState<CredentialRow[] | null>(null);
  const [counts, setCounts] = useState({ total: 0, valid: 0, revoked: 0, certificates: 0, badges: 0 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(""); // "" | "valid" | "revoked"
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api.credentialsPaged({ q, status: status || undefined, page, pageSize: PAGE_SIZE });
      setRows(r.data); setCounts({ total: r.total, valid: r.valid, revoked: r.revoked, certificates: r.certificates, badges: r.badges }); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); setRows([]); }
  }
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, status, page]);
  useEffect(() => { setPage(1); }, [q, status]);

  async function download(c: CredentialRow, kind: "pdf" | "vc") {
    setBusy(`${kind}:${c.id}`);
    try {
      const slug = c.learner.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      downloadBlob(kind === "pdf" ? `certificat-${slug}.pdf` : `credential-${slug}.jwt`, await api.credentialFile(c.id, kind));
    } catch (e: any) { await modal.alert({ title: "Téléchargement impossible", body: e?.message || "Erreur de téléchargement" }); }
    finally { setBusy(null); }
  }

  async function unrevoke(c: CredentialRow) {
    if (!(await modal.confirm({ title: `Rétablir le certificat de ${c.learner.name} ?`, body: "Il redeviendra vérifiable publiquement.", okLabel: "Rétablir" }))) return;
    setBusy(`un:${c.id}`);
    try { await api.unrevokeCredential(c.id); load(); }
    catch (e: any) { await modal.alert({ title: "Erreur", body: e?.message || "Erreur" }); }
    finally { setBusy(null); }
  }

  async function revoke(c: CredentialRow) {
    const reason = await modal.prompt({ title: `Révoquer le certificat de ${c.learner.name} ?`, label: "Motif (optionnel)", placeholder: "ex. erreur d'attribution", okLabel: "Révoquer" });
    if (reason === null) return;
    setBusy(c.id);
    try { await api.revokeCredential(c.id, reason || "Révoqué par l'administrateur"); load(); }
    catch (e: any) { await modal.alert({ title: "Erreur", body: e?.message || "Erreur" }); }
    finally { setBusy(null); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Open Badges 2.0 / 3.0</div>
          <h1>Certificats &amp; Badges</h1>
          <div className="sub">Certificats de fin de parcours et badges de fin de bloc — attestations vérifiables.</div>
        </div>
        <span className="row" style={{ gap: 8, alignItems: "center" }}>
          <ViewsBar screen="certs" config={{ q, status }} onApply={(c) => { setQ((c.q as string) ?? ""); setStatus((c.status as string) ?? ""); }} />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous</option>
            <option value="valid">Valides</option>
            <option value="revoked">Révoqués</option>
          </select>
          <label className="search" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-pill)", padding: "8px 14px", width: 240 }}>
            <input style={{ border: 0, background: "none", outline: "none", fontFamily: "inherit", fontSize: 13, width: "100%" }} placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </span>
      </div>

      {/* Seul le titre de FIN DE PARCOURS est un certificat ; les jalons de
          fin de bloc (Entrée, Compréhension, Pratique, Ancrage) sont des badges. */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <div className="kpi"><div className="val num">{rows ? counts.certificates : "…"}</div><div className="lbl">Certificats (fin de parcours)</div></div>
        <div className="kpi"><div className="val num">{rows ? counts.badges : "…"}</div><div className="lbl">Badges (fins de bloc)</div></div>
        <div className="kpi"><div className="val num" style={{ color: "var(--success)" }}>{rows ? counts.valid : "…"}</div><div className="lbl">Valides</div></div>
        <div className="kpi"><div className="val num" style={{ color: "var(--danger)" }}>{rows ? counts.revoked : "…"}</div><div className="lbl">Révoqués</div></div>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Apprenant</th><th>Parcours</th><th>Attestation</th><th>Délivré le</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {(rows ?? []).map((c) => (
                <tr key={c.id} style={{ cursor: "default" }}>
                  <td><div className="uitem"><span className="av" style={{ background: avatarColor(c.learner.name) }}>{initials(c.learner.name)}</span><div className="who"><b>{c.learner.name}</b><span>{c.learner.email}</span></div></div></td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>{c.courseTitle}</span></td>
                  <td>{c.achievementType === "CERTIFICATE"
                    ? <span className="pill pill--green">🎓 Certificat</span>
                    : <span className="pill pill--soft">Badge — {BADGE_FR[c.badgeLabel] ?? c.badgeLabel}</span>}</td>
                  <td><span style={{ fontSize: 12.5 }}>{ago(c.issuedAt)}</span></td>
                  <td>{c.revoked ? <span className="pill pill--red" title={c.revocationReason ?? ""}><span className="dot" />Révoqué</span> : <span className="pill pill--green"><span className="dot" />Valide</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <a className="btn btn--sm btn--ghost" href={c.verifyUrl} target="_blank" rel="noreferrer">Vérifier</a>
                    <button className="btn btn--sm btn--ghost" style={{ marginLeft: 6 }} disabled={busy === `pdf:${c.id}`} onClick={() => download(c, "pdf")}>{busy === `pdf:${c.id}` ? "…" : "PDF"}</button>
                    <button className="btn btn--sm btn--ghost" style={{ marginLeft: 6 }} title="Verifiable Credential (JWT signé)" disabled={busy === `vc:${c.id}`} onClick={() => download(c, "vc")}>{busy === `vc:${c.id}` ? "…" : "VC"}</button>
                    {!c.revoked && <button className="btn btn--sm" style={{ marginLeft: 6, color: "var(--danger)", borderColor: "var(--danger-tint)" }} disabled={busy === c.id} onClick={() => revoke(c)}>{busy === c.id ? "…" : "Révoquer"}</button>}
                    {c.revoked && <button className="btn btn--sm" style={{ marginLeft: 6 }} disabled={busy === `un:${c.id}`} onClick={() => unrevoke(c)}>{busy === `un:${c.id}` ? "…" : "Rétablir"}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows == null && <div className="empty">Chargement des certificats…</div>}
          {error && <div className="empty" style={{ color: "var(--danger)" }}>Erreur : {error}</div>}
          {rows != null && !error && rows.length === 0 && <div className="empty"><div className="big">🏅</div>Aucun certificat pour ce filtre.</div>}
          {rows != null && <Pager page={page} pageSize={PAGE_SIZE} total={counts.total} onPage={setPage} />}
        </div>
      </div>
    </div>
  );
}
