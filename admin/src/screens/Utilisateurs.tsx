import { useEffect, useState } from "react";
import { api, auth, rgpd, type UserRow } from "../lib/api";
import { avatarColor, initials, ago, genPassword } from "../lib/ui";
import { Pager, SortTh, ViewsBar } from "../lib/widgets";
import { modal } from "../lib/modal";

const ROLE_FR: Record<string, string> = {
  LEARNER: "Apprenant", ENTERPRISE_ADMIN: "Admin entreprise", ENTERPRISE_CLIENT: "Client", EMPLOYER: "Employeur",
  COURSE_ADMIN: "Admin", SUPER_ADMIN: "Super admin", INSTRUCTOR: "Formateur", EVALUATOR: "Évaluateur",
  REVIEWER: "Relecteur", LEARNING_DESIGNER: "Concepteur",
};
const ROLES = ["LEARNER", "LEARNING_DESIGNER", "REVIEWER", "INSTRUCTOR", "EVALUATOR", "COURSE_ADMIN", "SUPER_ADMIN", "ENTERPRISE_CLIENT", "EMPLOYER"];
const PAGE_SIZE = 25;

/** Edit drawer (M2-2): identity, role, activation, password reset. */
function EditDrawer({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: (msg: string) => void }) {
  const me = auth.user();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [disabled, setDisabled] = useState(user.disabled);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const self = me?.id === user.id;

  async function save() {
    setBusy(true); setErr(null);
    try {
      const patch: Record<string, unknown> = {};
      if (name.trim() !== user.name) patch.name = name.trim();
      if (email.trim() !== user.email) patch.email = email.trim();
      if (role !== user.role) patch.role = role;
      if (disabled !== user.disabled) patch.disabled = disabled;
      if (password) patch.password = password;
      if (Object.keys(patch).length === 0) { onClose(); return; }
      await api.updateUser(user.id, patch);
      onDone(`✅ Compte de ${email.trim()} mis à jour.`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  }

  const inp = { width: "100%", border: "1px solid var(--line-strong)", borderRadius: 8, padding: "9px 11px", fontFamily: "inherit", fontSize: 13.5 } as const;
  const lbl = { display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" as const, letterSpacing: 0.4, margin: "12px 0 4px" };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="dh">
          <div>
            <div className="eyebrow">Modifier le compte</div>
            <h2>{user.name}</h2>
            <span className="muted" style={{ fontSize: 12.5 }}>créé {ago(user.createdAt).toLowerCase()} · {user.enrollments} parcours</span>
          </div>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="db">
          <span style={lbl}>Nom</span>
          <input style={inp} value={name} onChange={(e) => setName(e.target.value)} />
          <span style={lbl}>E-mail</span>
          <input style={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <span style={lbl}>Rôle</span>
          <select className="select" style={{ width: "100%" }} value={role} disabled={self} title={self ? "Vous ne pouvez pas changer votre propre rôle" : undefined} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_FR[r] ?? r}</option>)}
          </select>
          <span style={lbl}>Statut du compte</span>
          <label className="row" style={{ gap: 8, fontSize: 13.5 }}>
            <input type="checkbox" checked={disabled} disabled={self} title={self ? "Vous ne pouvez pas désactiver votre propre compte" : undefined} onChange={(e) => setDisabled(e.target.checked)} />
            Désactivé (connexion bloquée, siège libéré)
          </label>
          <span style={lbl}>Nouveau mot de passe (optionnel)</span>
          <div className="row" style={{ gap: 6 }}>
            <input style={{ ...inp, flex: 1 }} value={password} placeholder="Laisser vide pour ne pas changer" onChange={(e) => setPassword(e.target.value)} />
            <button className="btn btn--sm" onClick={() => setPassword(genPassword())} title="Générer un mot de passe fort">🎲</button>
          </div>
          {password && password.length < 10 && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>10 caractères minimum.</p>}
          {err && <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>{err}</p>}
        </div>
        <div className="df">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn--primary" disabled={busy || !name.trim() || !email.trim() || (password !== "" && password.length < 10)} onClick={save}>{busy ? "…" : "Enregistrer"}</button>
        </div>
      </aside>
    </>
  );
}

export function Utilisateurs() {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("createdAt:desc");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [eraseId, setEraseId] = useState<string | null>(null); // row showing the erase choice
  const [note, setNote] = useState<string | null>(null);
  const [edit, setEdit] = useState<UserRow | null>(null);

  async function load() {
    try {
      const r = await api.usersPaged({ q, page, pageSize: PAGE_SIZE, sort });
      setRows(r.data); setTotal(r.total);
    } catch (e) { setNote(e instanceof Error ? e.message : "Erreur"); setRows([]); setTotal(0); }
  }
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, page, sort]);
  useEffect(() => { setPage(1); }, [q, sort]);

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
    const ok = await modal.confirm(mode === "anonymize"
      ? { title: `Programmer l'anonymisation de ${u.email} ?`, body: "Le compte est bloqué immédiatement ; les données personnelles seront effacées après le délai de grâce (l'historique agrégé est conservé). Restaurable d'ici là.", danger: true, okLabel: "Programmer" }
      : { title: `Programmer la SUPPRESSION de ${u.email} ?`, body: "Le compte est bloqué immédiatement ; suppression définitive en cascade après le délai de grâce. Restaurable d'ici là.", danger: true, okLabel: "Programmer" });
    if (!ok) return;
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
          <div className="eyebrow">{rows ? `${total} compte${total > 1 ? "s" : ""}` : "…"}</div>
          <h1>Utilisateurs</h1>
          <div className="sub">Tous les comptes — y compris les inscriptions publiques non encore inscrites à un parcours.</div>
        </div>
        <ViewsBar screen="users" config={{ q, sort }} onApply={(c) => { setQ((c.q as string) ?? ""); setSort((c.sort as string) ?? "createdAt:desc"); }} />
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
            <thead><tr>
              <SortTh label="Compte" field="name" sort={sort} onSort={setSort} />
              <SortTh label="Rôle" field="role" sort={sort} onSort={setSort} />
              <th>État</th><th>Parcours</th>
              <SortTh label="Créé" field="createdAt" sort={sort} onSort={setSort} />
              <th>Actions</th>
            </tr></thead>
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
                        <button className="btn btn--sm" disabled={busyId === u.id} onClick={() => setEdit(u)} title="Modifier le compte (nom, e-mail, rôle, activation, mot de passe)">✎ Modifier</button>
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
          {rows && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
        </div>
      </div>

      {edit && <EditDrawer user={edit} onClose={() => setEdit(null)} onDone={(msg) => { setEdit(null); setNote(msg); load(); }} />}
    </div>
  );
}
