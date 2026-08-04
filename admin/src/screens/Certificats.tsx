import { useMemo, useState } from "react";
import { api, type CredentialRow } from "../lib/api";
import { downloadBlob } from "../lib/csv";
import { avatarColor, initials, ago, useAsync } from "../lib/ui";

export function Certificats() {
  const { data, loading, error, reload } = useAsync<CredentialRow[]>(() => api.credentials(), []);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => (data ?? []).filter((c) => q === "" || (c.learner.name + c.learner.email + c.badgeLabel + c.courseTitle).toLowerCase().includes(q.toLowerCase())), [data, q]);
  const valid = (data ?? []).filter((c) => !c.revoked).length;
  const revoked = (data ?? []).filter((c) => c.revoked).length;

  async function download(c: CredentialRow, kind: "pdf" | "vc") {
    setBusy(`${kind}:${c.id}`);
    try {
      const slug = c.learner.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      downloadBlob(kind === "pdf" ? `certificat-${slug}.pdf` : `credential-${slug}.jwt`, await api.credentialFile(c.id, kind));
    } catch (e: any) { alert(e?.message || "Erreur de téléchargement"); }
    finally { setBusy(null); }
  }

  async function unrevoke(c: CredentialRow) {
    if (!window.confirm(`Rétablir le certificat de ${c.learner.name} ? Il redeviendra vérifiable publiquement.`)) return;
    setBusy(`un:${c.id}`);
    try { await api.unrevokeCredential(c.id); reload(); }
    catch (e: any) { alert(e?.message || "Erreur"); }
    finally { setBusy(null); }
  }

  async function revoke(c: CredentialRow) {
    const reason = window.prompt(`Révoquer le certificat de ${c.learner.name} ?\nMotif (optionnel) :`, "");
    if (reason === null) return;
    setBusy(c.id);
    try { await api.revokeCredential(c.id, reason || "Révoqué par l'administrateur"); reload(); }
    catch (e: any) { alert(e?.message || "Erreur"); }
    finally { setBusy(null); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Open Badges 2.0 / 3.0</div>
          <h1>Certificats</h1>
          <div className="sub">Attestations vérifiables délivrées aux apprenants certifiés.</div>
        </div>
        <label className="search" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-pill)", padding: "8px 14px", width: 260 }}>
          <input style={{ border: 0, background: "none", outline: "none", fontFamily: "inherit", fontSize: 13, width: "100%" }} placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
        <div className="kpi"><div className="val num">{data?.length ?? "…"}</div><div className="lbl">Certificats délivrés</div></div>
        <div className="kpi"><div className="val num" style={{ color: "var(--success)" }}>{data ? valid : "…"}</div><div className="lbl">Valides</div></div>
        <div className="kpi"><div className="val num" style={{ color: "var(--danger)" }}>{data ? revoked : "…"}</div><div className="lbl">Révoqués</div></div>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Apprenant</th><th>Parcours</th><th>Attestation</th><th>Délivré le</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ cursor: "default" }}>
                  <td><div className="uitem"><span className="av" style={{ background: avatarColor(c.learner.name) }}>{initials(c.learner.name)}</span><div className="who"><b>{c.learner.name}</b><span>{c.learner.email}</span></div></div></td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>{c.courseTitle}</span></td>
                  <td><span className="pill pill--soft">{c.badgeLabel}</span></td>
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
          {loading && <div className="empty">Chargement des certificats…</div>}
          {error && <div className="empty" style={{ color: "var(--danger)" }}>Erreur : {error}</div>}
          {!loading && !error && rows.length === 0 && <div className="empty"><div className="big">🏅</div>Aucun certificat délivré pour l'instant.</div>}
        </div>
      </div>
    </div>
  );
}
