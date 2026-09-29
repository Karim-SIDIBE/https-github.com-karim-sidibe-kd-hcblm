import { useEffect, useState } from "react";
import { api, auth, type Issuer, type Webhook } from "../lib/api";
import { genPassword, useAsync } from "../lib/ui";
import { modal } from "../lib/modal";

const BRAND = {
  name: (import.meta.env.VITE_BRAND_NAME as string | undefined)?.trim() || "DECLICK DIGITAL",
  operator: (import.meta.env.VITE_BRAND_OPERATOR as string | undefined)?.trim() || "KOMPETENCES DECLICK",
  issuer: (import.meta.env.VITE_BRAND_ISSUER as string | undefined)?.trim() || "KOMPETENCES AFRICA",
  theme: (import.meta.env.VITE_BRAND_THEME as string | undefined)?.trim() || "#E8650A",
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
  const [issTick, setIssTick] = useState(0);
  const issuer = useAsync<Issuer>(() => api.issuer(), [issTick]);
  const [issName, setIssName] = useState("");
  const [issUrl, setIssUrl] = useState("");
  const [issBusy, setIssBusy] = useState(false);
  const [issMsg, setIssMsg] = useState<string | null>(null);
  async function saveIssuer() {
    setIssBusy(true); setIssMsg(null);
    try {
      if (issName.trim()) await api.setSetting("credential_issuer_name", issName.trim());
      if (issUrl.trim()) await api.setSetting("credential_issuer_url", issUrl.trim());
      setIssMsg("✅ Émetteur mis à jour — appliqué aux prochains badges, certificats et pages de vérification.");
      setIssName(""); setIssUrl(""); setIssTick((t) => t + 1);
    } catch (e: any) { setIssMsg(`✗ ${e?.message || "Enregistrement impossible"}`); } finally { setIssBusy(false); }
  }
  const webhooks = useAsync<Webhook[]>(() => api.webhooks().catch(() => []), []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("LEARNING_DESIGNER");
  const [pwd, setPwd] = useState(genPassword());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);

  // Staff-2FA policy (M3) — SUPER_ADMIN only.
  const isSuperAdmin = auth.user()?.role === "SUPER_ADMIN";
  const [staff2fa, setStaff2fa] = useState<boolean | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  useEffect(() => { api.settings().then((s) => setStaff2fa(s["require_staff_2fa"] === true)).catch(() => setStaff2fa(false)); }, []);
  async function togglePolicy(on: boolean) {
    if (on && !(await modal.confirm({ title: "Exiger la 2FA pour les administrateurs ?", body: "Les comptes SUPER_ADMIN et COURSE_ADMIN sans double authentification seront invités à l'activer dès leur prochaine connexion (bandeau + redirection vers Sécurité). Chaque connexion sans 2FA est journalisée.", okLabel: "Activer la politique" }))) return;
    setPolicyBusy(true);
    try { await api.setSetting("require_staff_2fa", on); setStaff2fa(on); }
    catch (e) { await modal.alert({ title: "Modification impossible", body: e instanceof Error ? e.message : "Erreur" }); }
    finally { setPolicyBusy(false); }
  }

  async function runPurge() {
    if (!(await modal.confirm({ title: "Lancer la purge RGPD maintenant ?", body: "Exécute les effacements arrivés à échéance et supprime tokens/journaux/codes expirés.", okLabel: "Lancer" }))) return;
    setPurgeBusy(true); setPurgeMsg(null);
    try {
      const r = await api.runRetention();
      setPurgeMsg(`✅ ${r.erasuresExecuted} effacement(s) exécuté(s) — ${r.anonymized} anonymisé(s), ${r.deleted} supprimé(s) · ${r.tokensPurged} tokens · ${r.auditPurged} journaux · ${r.codesPurged} codes purgés.`);
    } catch (e: any) { setPurgeMsg(e?.message || "Erreur"); } finally { setPurgeBusy(false); }
  }

  // Assistant IA — état (clé configurée ?) + test de connexion (Super Admin).
  const ai = useAsync<{ configured: boolean; model: string; gradingModel: string | null; embeddings: boolean }>(() => api.aiStatus(), []);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  async function testAi() {
    setAiBusy(true); setAiMsg(null);
    try {
      const r = await api.aiTest();
      setAiMsg(`✅ Clé valide — ${r.model} a répondu en ${r.latencyMs} ms.`);
    } catch (e: any) { setAiMsg(`✗ ${e?.message || "Échec du test"}`); } finally { setAiBusy(false); }
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
              <div className="row between" style={{ padding: "9px 0" }}>
                <span className="muted" style={{ fontSize: 12.5 }}>Couleur</span>
                <span className="row" style={{ gap: 7 }}><span style={{ width: 16, height: 16, borderRadius: 4, background: BRAND.theme, display: "inline-block", border: "1px solid var(--line)" }} /><b style={{ fontSize: 13 }}>{BRAND.theme}</b></span>
              </div>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Configuré au déploiement (variables <code>VITE_BRAND_*</code>) — voir BRANDING.md. Pour un client SaaS, ces valeurs changent par configuration.</p>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Émetteur des certificats</h3>{isSuperAdmin && <span className="pill pill--soft">modifiable</span>}</div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {issuer.loading ? <span className="muted">Chargement…</span> : issuer.error ? <span style={{ color: "var(--danger)" }}>{issuer.error}</span> : issuer.data && (<>
                <Row k="Nom" v={issuer.data.name} />
                <Row k="URL" v={issuer.data.url} />
                <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Imprimé sur les badges Open Badges, les certificats signés (VC) et les pages publiques de vérification. Les certificats déjà émis ne sont pas réécrits.</p>
                {isSuperAdmin && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div><label style={lbl}>Nouveau nom <span className="muted" style={{ fontWeight: 400 }}>(vide = inchangé)</span></label><input style={field} value={issName} placeholder={issuer.data.name} onChange={(e) => setIssName(e.target.value)} /></div>
                    <div><label style={lbl}>Nouvelle URL <span className="muted" style={{ fontWeight: 400 }}>(vide = inchangée)</span></label><input style={field} value={issUrl} placeholder={issuer.data.url} onChange={(e) => setIssUrl(e.target.value)} /></div>
                    <button className="btn btn--sm btn--primary" style={{ alignSelf: "flex-start" }} disabled={issBusy || (!issName.trim() && !issUrl.trim())} onClick={() => void saveIssuer()}>{issBusy ? "…" : "Enregistrer"}</button>
                    {issMsg && <p style={{ fontSize: 12.5, margin: 0, fontWeight: 600, color: issMsg.startsWith("✅") ? "var(--green)" : "var(--danger)" }}>{issMsg}</p>}
                  </div>
                )}
              </>)}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>🤖 Assistant IA</h3>
              {ai.data && <span className={`pill ${ai.data.configured ? "pill--green" : "pill--soft"}`}>{ai.data.configured ? "configuré" : "repli hors-ligne"}</span>}
            </div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              {ai.loading ? <span className="muted">Chargement…</span> : ai.error ? <span className="muted" style={{ fontSize: 12.5 }}>{ai.error}</span> : ai.data && (<>
                <Row k="Modèle" v={ai.data.model} />
                {ai.data.gradingModel && <Row k="Modèle de notation" v={ai.data.gradingModel} />}
                <Row k="Recherche sémantique" v={ai.data.embeddings ? "embeddings actifs" : "repli lexical"} />
                <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                  {ai.data.configured
                    ? "L'import de parcours (complément par bloc), le feedback formatif, le tuteur et les brouillons de cours utilisent le modèle réel."
                    : <>Sans clé, tout fonctionne avec des replis déterministes hors-ligne — l'import de parcours reste 100 % opérationnel. Pour activer l'IA réelle : ajoutez <code>ANTHROPIC_API_KEY</code> dans <code>deploy/.env</code> (mode d'emploi et coûts commentés dans le fichier), puis relancez l'API.</>}
                </p>
                {isSuperAdmin && (
                  <div style={{ marginTop: 10 }}>
                    <button className="btn btn--sm" disabled={aiBusy} onClick={() => void testAi()}>{aiBusy ? "…" : "⚡ Tester la connexion IA"}</button>
                    {aiMsg && <p style={{ fontSize: 12.5, margin: "8px 0 0", fontWeight: 600, color: aiMsg.startsWith("✅") ? "var(--green)" : "var(--danger)" }}>{aiMsg}</p>}
                  </div>
                )}
              </>)}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Système</h3></div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              <Row k="API" v={API} />
              <Row k="Console" v="DECLICK DIGITAL Admin v0.1" />
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 600, cursor: isSuperAdmin ? "pointer" : "default" }}
                  title={isSuperAdmin ? "Politique de sécurité de la console" : "Réservé au super-administrateur"}>
                  <input type="checkbox" checked={staff2fa === true} disabled={!isSuperAdmin || policyBusy || staff2fa === null}
                    onChange={(e) => void togglePolicy(e.target.checked)} />
                  🔐 Exiger la 2FA pour les administrateurs
                </label>
                <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0" }}>S'applique aux rôles SUPER_ADMIN et COURSE_ADMIN : sans 2FA active, la console les redirige vers l'activation à chaque connexion (et la connexion « en grâce » est journalisée dans l'audit).</p>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <button className="btn btn--sm" disabled={purgeBusy} onClick={runPurge}>{purgeBusy ? "…" : "🧹 Lancer la purge RGPD"}</button>
                <p className="muted" style={{ fontSize: 11.5, margin: "8px 0 0" }}>Exécute les effacements arrivés à échéance (délai de grâce écoulé) et purge les tokens/journaux/codes expirés. Tous les jobs de fond sont visibles dans <a href="#/jobs">Jobs &amp; planification</a>.</p>
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
                  ? <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Aucun webhook configuré.</p>
                  : <div>{webhooks.data!.map((w) => <Row key={w.id} k={(w.events ?? []).join(", ") || "webhook"} v={w.url} />)}</div>}
              <p style={{ fontSize: 12.5, marginTop: 10 }}><a className="btn btn--sm" href="#/webhooks">Gérer dans Webhooks →</a></p>
              <p className="muted" style={{ fontSize: 11.5, margin: "8px 0 0" }}>Les clés IA, SMS/WhatsApp/push et le LRS xAPI se configurent côté serveur (variables d'environnement) — voir deploy/.env.example.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
