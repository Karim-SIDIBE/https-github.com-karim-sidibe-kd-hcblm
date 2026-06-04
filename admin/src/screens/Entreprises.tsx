import { useEffect, useState } from "react";
import { api, type Org, type Seats, type OrgMember } from "../lib/api";
import { useAsync, genPassword } from "../lib/ui";

const field: React.CSSProperties = { width: "100%", padding: "9px 11px", border: "1px solid var(--line-strong)", borderRadius: 9, fontFamily: "inherit", fontSize: 13.5 };
const lbl: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--fg-1)", margin: "0 0 5px" };

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function Entreprises() {
  const [tick, setTick] = useState(0);
  const orgs = useAsync<Org[]>(() => api.organizations(), [tick]);
  const [sel, setSel] = useState("");
  const selectedOrg = (orgs.data ?? []).find((o) => o.id === sel) ?? null;

  // create org
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  async function createOrg(e: React.FormEvent) {
    e.preventDefault(); setCreating(true); setCreateErr(null);
    try {
      const o = await api.createOrg(name.trim(), (slug.trim() || slugify(name)));
      setName(""); setSlug(""); setTick((t) => t + 1); setSel(o.id);
    } catch (err) { setCreateErr(err instanceof Error ? err.message : "Erreur"); }
    finally { setCreating(false); }
  }

  // detail
  const [seats, setSeats] = useState<Seats | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [detailTick, setDetailTick] = useState(0);
  useEffect(() => {
    if (!sel) { setSeats(null); setMembers([]); return; }
    let alive = true;
    (async () => {
      try { const [s, m] = await Promise.all([api.orgSeats(sel), api.orgMembers(sel)]); if (alive) { setSeats(s); setMembers(m); } } catch { /* */ }
    })();
    return () => { alive = false; };
  }, [sel, detailTick]);

  // seats editor
  const [seatInput, setSeatInput] = useState(0);
  const [savingSeats, setSavingSeats] = useState(false);
  useEffect(() => { if (seats) setSeatInput(seats.seats); }, [seats]);
  async function saveSeats() {
    if (!sel) return; setSavingSeats(true);
    try { await api.setOrgSeats(sel, Math.max(0, Math.floor(seatInput))); setDetailTick((t) => t + 1); setTick((t) => t + 1); }
    finally { setSavingSeats(false); }
  }

  // designate admin
  const [aName, setAName] = useState("");
  const [aEmail, setAEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  async function addAdmin(e: React.FormEvent) {
    e.preventDefault(); if (!sel) return;
    setAddingAdmin(true); setAdminMsg(null);
    try {
      const pwd = genPassword();
      const u = await api.createUser({ name: aName.trim(), email: aEmail.trim(), password: pwd, role: "ENTERPRISE_ADMIN" });
      await api.addOrgMember(sel, u.id, "ADMIN");
      let invited = false;
      try { await api.invite(u.id, pwd); invited = true; } catch { /* best-effort */ }
      setAdminMsg(invited
        ? `✅ ${aEmail} ajouté·e comme administrateur — invitation envoyée.`
        : `✅ ${aEmail} ajouté·e comme administrateur. Mot de passe à communiquer : ${pwd}`);
      setAName(""); setAEmail(""); setDetailTick((t) => t + 1);
    } catch (err) { setAdminMsg(`✗ ${err instanceof Error ? err.message : "Erreur"}`); }
    finally { setAddingAdmin(false); }
  }

  const admins = members.filter((m) => m.orgRole === "OWNER" || m.orgRole === "ADMIN");

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Organisation</div>
          <h1>Entreprises &amp; licences</h1>
          <div className="sub">Créez un compte entreprise, allouez ses licences (sièges) et désignez son administrateur.</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.1fr", alignItems: "start", gap: 16 }}>
        {/* Left: list + create */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-h"><h3>Entreprises</h3><span className="pill pill--soft">{orgs.data?.length ?? 0}</span></div>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead><tr><th>Entreprise</th><th>Sièges</th><th>Membres</th></tr></thead>
                <tbody>
                  {(orgs.data ?? []).map((o) => (
                    <tr key={o.id} onClick={() => setSel(o.id)} style={{ cursor: "pointer", background: o.id === sel ? "var(--bg-tint)" : undefined }}>
                      <td><div className="who"><b style={{ fontSize: 13.5 }}>{o.name}</b><span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{o.slug}</span></div></td>
                      <td><span className="num">{o.seats}</span></td>
                      <td><span className="num">{o._count?.memberships ?? 0}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orgs.loading && <div className="empty">Chargement…</div>}
              {!orgs.loading && (orgs.data?.length ?? 0) === 0 && <div className="empty"><div className="big">🏢</div>Aucune entreprise. Créez-en une ci-dessous.</div>}
            </div>
          </div>

          <form className="card" onSubmit={createOrg}>
            <div className="card-h"><h3>Nouvelle entreprise</h3></div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div><label style={lbl}>Nom</label><input style={field} value={name} onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)); }} placeholder="Orange Côte d'Ivoire" required /></div>
              <div><label style={lbl}>Identifiant (slug)</label><input style={field} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="orange-ci" pattern="[a-z0-9-]+" required /></div>
              {createErr && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{createErr}</p>}
              <button className="btn btn--primary" disabled={creating} style={{ justifyContent: "center", padding: 10 }}>{creating ? "…" : "Créer l'entreprise"}</button>
            </div>
          </form>
        </div>

        {/* Right: selected org detail */}
        <div className="card" style={{ position: "sticky", top: 16 }}>
          {!selectedOrg
            ? <div className="empty" style={{ padding: 40 }}><div className="big">👈</div>Sélectionnez une entreprise pour gérer ses sièges et ses administrateurs.</div>
            : (
              <>
                <div className="card-h"><h3>{selectedOrg.name}</h3></div>
                <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Seats */}
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Licences (sièges)</div>
                    {seats && <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>{seats.used} utilisé{seats.used > 1 ? "s" : ""} · {seats.available} disponible{seats.available > 1 ? "s" : ""}</p>}
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <input type="number" min={0} style={{ ...field, width: 110 }} value={seatInput} onChange={(e) => setSeatInput(Number(e.target.value))} />
                      <button className="btn btn--primary btn--sm" disabled={savingSeats} onClick={saveSeats}>{savingSeats ? "…" : "Enregistrer"}</button>
                      {seats && seatInput < seats.used && <span style={{ color: "var(--danger)", fontSize: 12 }}>≥ {seats.used} (déjà utilisés)</span>}
                    </div>
                  </div>

                  {/* Admins */}
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Administrateurs de l'entreprise</div>
                    {admins.length === 0
                      ? <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>Aucun administrateur. Désignez-en un ci-dessous.</p>
                      : (
                        <table className="table" style={{ marginBottom: 10 }}>
                          <tbody>
                            {admins.map((m) => (
                              <tr key={m.user.id}><td><div className="who"><b style={{ fontSize: 13 }}>{m.user.name}</b><span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{m.user.email}</span></div></td>
                                <td style={{ textAlign: "right" }}><span className="pill pill--navy">{m.orgRole}</span></td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    <form onSubmit={addAdmin} style={{ display: "flex", flexDirection: "column", gap: 9, background: "var(--bg-soft)", padding: 12, borderRadius: 10 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <input style={field} value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Nom de l'administrateur" required />
                        <input style={field} type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} placeholder="admin@entreprise.com" required />
                      </div>
                      <button className="btn btn--primary btn--sm" disabled={addingAdmin} style={{ justifyContent: "center" }}>{addingAdmin ? "…" : "Désigner l'administrateur"}</button>
                      {adminMsg && <div style={{ fontSize: 12.5, color: adminMsg.startsWith("✗") ? "var(--danger)" : "var(--fg-2)" }}>{adminMsg}</div>}
                    </form>
                    <p className="muted" style={{ fontSize: 11.5, margin: "8px 0 0" }}>L'administrateur se connecte ensuite sur <b>entreprise.declick.digital</b> pour gérer ses apprenants.</p>
                  </div>
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
