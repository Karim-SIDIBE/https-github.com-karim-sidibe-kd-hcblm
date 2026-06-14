import { useState } from "react";
import { api, type Issuer, type Webhook } from "../lib/api";
import { genPassword, useAsync } from "../lib/ui";

const BRAND = {
  name: (import.meta.env.VITE_BRAND_NAME as string | undefined)?.trim() || "DECLICK DIGITAL",
  operator: (import.meta.env.VITE_BRAND_OPERATOR as string | undefined)?.trim() || "KOMPETENCES DECLICK",
  issuer: (import.meta.env.VITE_BRAND_ISSUER as string | undefined)?.trim() || "KOMPETENCES AFRICA",
  theme: (import.meta.env.VITE_BRAND_THEME as string | undefined)?.trim() || "#F36F21",
};
const API = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:4000/api/v1";
const STAFF_ROLES = [
  ["LEARNING_DESIGNER", "Concepteur pédagogique"], ["REVIEWER", "Relecteur"], ["INSTRUCTOR", "Instructeur"],
  ["EVALUATOR", "Évaluateur"], ["COURSE_ADMIN", "Administrateur cours"], ["ENTERPRISE_CLIENT", "Client entreprise"], ["SUPER_ADMIN", "Super Admin"],
] as const;

const field: React.CSSProperties = { width: "100%", padding: "9px 11px", border: "1px solid var(--line-strong)", borderRadius: 8, fontFamily: "inherit", fontSize: 13.5 };
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--fg-1)", margin: "0 0 5px" };
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="row between" style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
    <span className="muted" style={{ fontSize: 12.5 }}>{k}</span><b style={{ fontSize: 13, color: "var(--fg-1)" }}>{v}</b>
  </div>
);

export function Settings() {
  const issuer = useAsync<Issuer>(() => api.issuer(), []);
  const webhooks = useAsync<Webhook[]>(() => api.webhooks().catch(() => []), []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("LEARNING_DESIGNER");
  const [pwd, setPwd] = useState(genPassword());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);

  async function runPurge() {
    if (!window.confirm("Lancer la purge RGPD maintenant ?\nExécute les effacements arrivés à échéance et supprime tokens/journaux/codes expirés.")) return;
    setPurgeBusy(true); setPurgeMsg(null);
    try {
      const r = await api.runRetention();
      setPurgeMsg(`✅ ${r.erasuresExecuted} effacement(s) exécuté(s) — ${r.anonymized} anonymisé(s), ${r.deleted} supprimé(s) · ${r.tokensPurged} tokens · ${r.auditPurged} journaux · ${r.codesPurged} codes purgés.`);
    } catch (e: any) { setPurgeMsg(e?.message || "Erreur"); } finally { setPurgeBusy(false); }
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.createUser({ name: name.trim(), email: email.trim(), role, password: pwd });
      setMsg({ ok: true, text: `Compte créé : ${email} (${role}). Mot de passe : ${pwd}` });
      setName(""); setEmail(""); setPwd(genPassword());
    } catch (e: any) { setMsg({ ok: false, text: e?.message || "Erreur" }); } finally { setBusy(false); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Système</div>
          <h1>Réglages</h1>
          <div className="sub">Identité, émetteur des certificats, comptes du personnel et intégrations.</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-h"><h3>Identité de marque</h3><span className="pill pill--soft">white-label</span></div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              <Row k="Nom de la plateforme" v={BRAND.name} />
              <Row k="Opéré par" v={BRAND.operator} />
              <Row k="Émetteur (certificats)" v={BRAND.issuer} />
              <div className="row between" style={{ padding: "9px 0" }}>
                <span className="muted" style={{ fontSize: 12.5 }}>Couleur</span>
                <span className="row" style={{ gap: 7 }}><span style={{ width: 16, height: 16, borderRadius: 4, background: BRAND.theme, display: "inline-block", border: "1px solid var(--line)" }} /><b style={{ fontSize: 13 }}>{BRAND.theme}</b></span>
              </div>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Configuré au déploiement (variables <code>VITE_BRAND_*</code>) — voir BRANDING.md. Pour un client SaaS, ces valeurs changent par configuration.</p>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Émetteur des certificats</h3></div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {issuer.loading ? <span className="muted">Chargement…</span> : issuer.error ? <span style={{ color: "var(--danger)" }}>{issuer.error}</span> : issuer.data && (<>
                <Row k="Nom" v={issuer.data.name} />
                <Row k="URL" v={issuer.data.url} />
                <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Open Badges 2.0 / 3.0 · <code>CREDENTIAL_ISSUER_NAME</code> côté serveur.</p>
              </>)}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Système</h3></div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              <Row k="API" v={API} />
              <Row k="Console" v="DECLICK DIGITAL Admin v0.1" />
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <button className="btn btn--sm" disabled={purgeBusy} onClick={runPurge}>{purgeBusy ? "…" : "🧹 Lancer la purge RGPD"}</button>
                <p className="muted" style={{ fontSize: 11.5, margin: "8px 0 0" }}>Exécute les effacements arrivés à échéance (délai de grâce écoulé) et purge les tokens/journaux/codes expirés. Normalement déclenché par un cron quotidien.</p>
                {purgeMsg && <p style={{ fontSize: 12.5, margin: "8px 0 0", fontWeight: 600, color: purgeMsg.startsWith("✅") ? "var(--green)" : "var(--danger)" }}>{purgeMsg}</p>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form className="card" onSubmit={createStaff}>
            <div className="card-h"><h3>Créer un compte du personnel</h3></div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={lbl}>Nom complet</label><input style={field} value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div><label style={lbl}>E-mail</label><input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><label style={lbl}>Rôle</label><select style={field} value={role} onChange={(e) => setRole(e.target.value)}>{STAFF_ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div>
                <label style={lbl}>Mot de passe initial</label>
                <div className="row" style={{ gap: 8 }}><input style={{ ...field, fontFamily: "monospace" }} value={pwd} onChange={(e) => setPwd(e.target.value)} required /><button type="button" className="btn btn--sm" onClick={() => setPwd(genPassword())}>Générer</button></div>
              </div>
              <button className="btn btn--primary" disabled={busy} style={{ justifyContent: "center", padding: 11 }}>{busy ? "…" : "Créer le compte"}</button>
              {msg && <div className="card" style={{ background: msg.ok ? "var(--success-tint)" : "var(--danger-tint)", border: "none", padding: "11px 13px", fontSize: 12.5, color: msg.ok ? "var(--fg-1)" : "var(--danger)" }}>{msg.ok ? "✅ " : "✗ "}{msg.text}</div>}
            </div>
          </form>

          <div className="card">
            <div className="card-h"><h3>Intégrations & webhooks</h3><span className="pill pill--soft">{webhooks.data?.length ?? 0}</span></div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {webhooks.loading ? <span className="muted">Chargement…</span>
                : (webhooks.data?.length ?? 0) === 0
                  ? <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Aucun webhook configuré. Les clés IA, SMS/WhatsApp/push et le LRS xAPI se configurent côté serveur (variables d'environnement) — voir deploy/.env.example.</p>
                  : <div>{webhooks.data!.map((w) => <Row key={w.id} k={(w.events ?? []).join(", ") || "webhook"} v={w.url} />)}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
