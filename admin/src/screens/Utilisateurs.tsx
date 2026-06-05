import { useEffect, useState } from "react";
import { api, type UserRow } from "../lib/api";
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
  async function remove(u: UserRow) {
    if (!window.confirm(`Supprimer définitivement ${u.name} (${u.email}) ?\nIrréversible : compte, inscriptions et progression effacés.`)) return;
    setBusyId(u.id); setNote(null);
    try { await api.deleteUser(u.id); setNote(`🗑️ ${u.email} supprimé.`); load(); }
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
                      {u.disabled ? <span className="pill pill--red">Désactivé</span> : u.verified ? <span className="pill pill--green">Vérifié</span> : <span className="pill pill--warn">Non vérifié</span>}
                      {u.locked && <span className="pill pill--red">Verrouillé</span>}
                    </div>
                  </td>
                  <td><span className="num">{u.enrollments}</span></td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>{ago(u.createdAt)}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => resend(u)} title="Réinitialise le mot de passe, déverrouille et envoie l'invitation">{busyId === u.id ? "…" : "↻ Réinitialiser"}</button>
                      <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => remove(u)} title="Supprimer définitivement" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>🗑️</button>
                    </div>
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
