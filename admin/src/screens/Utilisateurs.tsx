import { useEffect, useState } from "react";
import { api, rgpd, type UserRow } from "../lib/api";
import { avatarColor, initials, ago } from "../lib/ui";

const ROLE_FR: Record<string, string> = {
  LEARNER: "Apprenant", ENTERPRISE_ADMIN: "Admin entreprise", ENTERPRISE_CLIENT: "Client", EMPLOYER: "Employeur",
  COURSE_ADMIN: "Admin", SUPER_ADMIN: "Super admin", INSTRUCTOR: "Formateur", EVALUATOR: "Évaluateur",
  REVIEWER: "Relecteur", LEARNING_DESIGNER: "Concepteur",
};

export function Utilisateurs() {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [eraseId, setEraseId] = useState<string | null>(null); // row showing the erase choice
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    setRows(null);
    try { setRows(await api.users(q)); } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); setRows([]); }
  }
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  async function resend(u: UserRow) {
    setBusyId(u.id); setNote(null);
    try {
      const r = await api.invite(u.id);
      setNote(r.delivered
        ? `✅ Invitation envoyée à ${u.email} (compte déverrouillé). Nouveau mot de passe : ${r.tempPassword}`
        : `⚠️ Canal d'envoi non configuré — non délivré. Nouveau mot de passe (déverrouillé) à communiquer : ${r.tempPassword}`);
      load();
    } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }
  // RGPD — export (Art. 15/20): download everything we hold as JSON.
  async function exportData(u: UserRow) {
    setBusyId(u.id); setNote(null);
    try {
      const data = await rgpd.exportUser(u.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `rgpd-export-${u.email}.json`; a.click();
      URL.revokeObjectURL(a.href);
      setNote(`✅ Données de ${u.email} exportées (JSON).`);
    } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }
  // RGPD — erasure (Art. 17): schedule it (reversible during the grace period).
  async function erase(u: UserRow, mode: "anonymize" | "delete") {
    const what = mode === "anonymize"
      ? `Programmer l'anonymisation de ${u.email} ?\nLe compte est bloqué immédiatement ; les données personnelles seront effacées après le délai de grâce (l'historique agrégé est conservé). Restaurable d'ici là.`
      : `Programmer la SUPPRESSION de ${u.email} ?\nLe compte est bloqué immédiatement ; suppression définitive en cascade après le délai de grâce. Restaurable d'ici là.`;
    if (!window.confirm(what)) return;
    setBusyId(u.id); setEraseId(null); setNote(null);
    try { const r = await rgpd.erase(u.id, mode); setNote(`🗑️ ${u.email} — effacement programmé (purge le ${new Date(r.purgeAt).toLocaleDateString("fr-FR")}). Restaurable jusque-là.`); load(); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }
  // Cancel a scheduled erasure.
  async function restore(u: UserRow) {
    setBusyId(u.id); setNote(null);
    try { await rgpd.restore(u.id); setNote(`✅ ${u.email} restauré.`); load(); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }
  // Force log-out of all the user's devices (offboarding / security).
  async function forceLogout(u: UserRow) {
    setBusyId(u.id); setNote(null);
    try { const r = await rgpd.revokeUserSessions(u.id); setNote(`✅ ${u.email} déconnecté de ${r.revoked} session(s).`); }
    catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{rows ? `${rows.length} compte${rows.length > 1 ? "s" : ""}` : "…"}</div>
          <h1>Utilisateurs</h1>
          <div className="sub">Tous les comptes — y compris les inscriptions publiques non encore inscrites à un parcours.</div>
        </div>
      </div>

      {note && <div className="card" style={{ background: (note.startsWith("✅") || note.startsWith("🗑️")) ? "var(--success-tint)" : "var(--warning-tint)", border: "none", padding: "11px 14px", marginBottom: 14, fontSize: 13 }} onClick={() => setNote(null)}>{note}</div>}

      <div className="card">
        <div className="card-h" style={{ paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
          <label className="search" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", padding: "8px 14px", width: 320 }}>
            <input style={{ border: 0, background: "none", outline: "none", fontFamily: "inherit", fontSize: 13, width: "100%" }} placeholder="Rechercher par nom ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Compte</th><th>Rôle</th><th>État</th><th>Parcours</th><th>Créé</th><th>Actions</th></tr></thead>
            <tbody>
              {(rows ?? []).map((u) => (
                <tr key={u.id}>
                  <td><div className="uitem"><span className="av" style={{ background: avatarColor(u.name) }}>{initials(u.name)}</span><div className="who"><b>{u.name}</b><span>{u.email}</span></div></div></td>
                  <td><span className="pill pill--soft">{ROLE_FR[u.role] ?? u.role}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {u.anonymized ? <span className="pill pill--soft">Anonymisé</span>
                        : u.deletionDaysLeft != null ? <span className="pill pill--warn" title="Effacement programmé">🕑 Suppression — restaurable {u.deletionDaysLeft} j</span>
                        : u.disabled ? <span className="pill pill--red">Désactivé</span> : u.verified ? <span className="pill pill--green">Vérifié</span> : <span className="pill pill--warn">Non vérifié</span>}
                      {u.locked && <span className="pill pill--red">Verrouillé</span>}
                    </div>
                  </td>
                  <td><span className="num">{u.enrollments}</span></td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>{ago(u.createdAt)}</span></td>
                  <td>
                    {u.anonymized ? (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}><span className="muted" style={{ fontSize: 12.5 }}>Compte anonymisé</span></div>
                    ) : u.deletionDaysLeft != null ? (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => exportData(u)} title="Exporter les données (RGPD Art. 15/20)">⬇ Données</button>
                        <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => restore(u)} title="Annuler l'effacement programmé et réactiver le compte" style={{ color: "var(--green)", borderColor: "var(--green)" }}>{busyId === u.id ? "…" : "↩ Restaurer"}</button>
                      </div>
                    ) : eraseId === u.id ? (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                        <span className="muted" style={{ fontSize: 12 }}>Programmer :</span>
                        <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => erase(u, "anonymize")} title="Effacer les données personnelles, garder l'historique agrégé">Anonymiser</button>
                        <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => erase(u, "delete")} title="Suppression dure en cascade" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>Supprimer</button>
                        <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => setEraseId(null)}>Annuler</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => resend(u)} title="Réinitialise le mot de passe, déverrouille et envoie l'invitation">{busyId === u.id ? "…" : "↻ Réinitialiser"}</button>
                        <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => exportData(u)} title="Exporter les données (RGPD Art. 15/20)">⬇ Données</button>
                        <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => forceLogout(u)} title="Déconnecter tous les appareils">⎋</button>
                        <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => setEraseId(u.id)} title="Effacement RGPD (Art. 17) — programmé, restaurable" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>Effacer</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows && <div className="empty">Chargement…</div>}
          {rows && rows.length === 0 && <div className="empty"><div className="big">👤</div>Aucun compte.</div>}
        </div>
      </div>
    </div>
  );
}
