import { useState } from "react";
import { api, type IntegrationsStatus } from "../lib/api";
import { ago, useAsync } from "../lib/ui";
import { modal } from "../lib/modal";

const On = () => <span className="pill pill--green"><span className="dot" />Configuré</span>;
const Off = () => <span className="pill pill--soft">Non configuré</span>;

function UrlRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="row between" style={{ padding: "7px 0", borderBottom: "1px solid var(--line)", gap: 10 }}>
      <span className="muted" style={{ fontSize: 12.5, flexShrink: 0 }}>{k}</span>
      <span className="row" style={{ gap: 6, minWidth: 0 }}>
        <code style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>{v}</code>
        <button className="btn btn--sm btn--ghost" title="Copier" onClick={() => navigator.clipboard?.writeText(v)}>⧉</button>
      </span>
    </div>
  );
}

function LtiForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: "", issuer: "", clientId: "", deploymentId: "", authLoginUrl: "", jwksUrl: "", tokenUrl: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const inp = { width: "100%", border: "1px solid var(--line-strong)", borderRadius: 8, padding: "8px 10px", fontFamily: "inherit", fontSize: 12.5 } as const;
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" as const, letterSpacing: 0.4, margin: "8px 0 3px" };

  async function save() {
    if (!f.issuer || !f.clientId || !f.authLoginUrl || !f.jwksUrl) { setErr("Issuer, Client ID, URL de login et JWKS sont requis."); return; }
    setBusy(true); setErr(null);
    try {
      await api.addLtiPlatform({ name: f.name || undefined, issuer: f.issuer, clientId: f.clientId, deploymentId: f.deploymentId || undefined, authLoginUrl: f.authLoginUrl, jwksUrl: f.jwksUrl, tokenUrl: f.tokenUrl || undefined });
      onDone();
    } catch (e: any) { setErr(e?.message || "Erreur"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 8 }}>
      <b style={{ fontSize: 12.5 }}>Enregistrer une plateforme LMS (LTI 1.3)</b>
      <span style={lbl}>Nom (libre)</span><input style={inp} value={f.name} onChange={set("name")} placeholder="Moodle RH" />
      <span style={lbl}>Issuer</span><input style={inp} value={f.issuer} onChange={set("issuer")} placeholder="https://lms.client.com" />
      <span style={lbl}>Client ID</span><input style={inp} value={f.clientId} onChange={set("clientId")} />
      <span style={lbl}>Deployment ID (optionnel)</span><input style={inp} value={f.deploymentId} onChange={set("deploymentId")} />
      <span style={lbl}>URL de login OIDC</span><input style={inp} value={f.authLoginUrl} onChange={set("authLoginUrl")} placeholder="https://lms.client.com/mod/lti/auth.php" />
      <span style={lbl}>URL JWKS</span><input style={inp} value={f.jwksUrl} onChange={set("jwksUrl")} placeholder="https://lms.client.com/mod/lti/certs.php" />
      <span style={lbl}>URL de token (optionnel)</span><input style={inp} value={f.tokenUrl} onChange={set("tokenUrl")} />
      {err && <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--danger)", margin: "8px 0 0" }}>{err}</p>}
      <button className="btn btn--sm btn--primary" style={{ marginTop: 10 }} disabled={busy} onClick={save}>{busy ? "…" : "Enregistrer la plateforme"}</button>
    </div>
  );
}

export function Integrations() {
  const status = useAsync<IntegrationsStatus>(() => api.integrationsStatus(), []);
  const [ltiForm, setLtiForm] = useState(false);
  const [scimBusy, setScimBusy] = useState<string | null>(null);
  const [scimToken, setScimToken] = useState<{ org: string; token: string; endpoint: string } | null>(null);

  const s = status.data;

  async function provisionScim(orgId: string, orgName: string, already: boolean) {
    const ok = await modal.confirm({
      title: `Générer un jeton SCIM pour ${orgName} ?`,
      body: already ? "Un jeton existe déjà : le régénérer INVALIDE l'ancien (l'IdP devra être reconfiguré)." : "Le jeton n'est affiché qu'une seule fois — transmettez-le à l'équipe IT du client.",
      okLabel: already ? "Régénérer" : "Générer",
      danger: already,
    });
    if (!ok) return;
    setScimBusy(orgId);
    try {
      const r = await api.scimToken(orgId);
      setScimToken({ org: orgName, token: r.token, endpoint: r.endpoint });
      status.reload();
    } catch (e: any) { await modal.alert({ title: "Génération impossible", body: e?.message || "Erreur" }); }
    finally { setScimBusy(null); }
  }

  return (
    <div className="content">
      <div className="pagehead">
        <div>
          <div className="eyebrow">SSO · LTI · Provisionnement</div>
          <h1>Intégrations</h1>
          <div className="sub">Ce qu'il faut fournir à un IdP d'entreprise (SAML/OIDC), à un LMS consommateur (LTI 1.3) ou à un SIRH (SCIM 2.0).</div>
        </div>
      </div>

      {status.error && <div className="card" style={{ marginBottom: 14 }}><div className="card-b" style={{ color: "var(--danger)" }}>Erreur : {status.error}</div></div>}
      {!s ? <div className="card"><div className="card-b">Chargement…</div></div> : (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card">
              <div className="card-h"><h3>SAML 2.0 (SSO entreprise)</h3>{s.saml.enabled ? <On /> : <Off />}</div>
              <div className="card-b" style={{ paddingTop: 4 }}>
                <UrlRow k="Métadonnées SP (XML)" v={s.saml.metadataUrl} />
                <UrlRow k="URL de connexion" v={s.saml.loginUrl} />
                <UrlRow k="ACS (callback)" v={s.saml.acsUrl} />
                <div className="row between" style={{ padding: "7px 0" }}>
                  <span className="muted" style={{ fontSize: 12.5 }}>Entity ID · JIT provisioning</span>
                  <b style={{ fontSize: 12.5 }}>{s.saml.issuer} · {s.saml.jitProvision ? "oui" : "non"}</b>
                </div>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                  {s.saml.enabled
                    ? "Donnez l'URL de métadonnées à l'IdP du client (Azure AD, Okta…)."
                    : "Configurez SAML_ENTRY_POINT, SAML_CALLBACK_URL et SAML_IDP_CERT côté serveur (deploy/.env) pour activer."}
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-h"><h3>OIDC (jetons externes)</h3>{s.oidc.enabled ? <On /> : <Off />}</div>
              <div className="card-b" style={{ paddingTop: 4 }}>
                {s.oidc.enabled ? (<>
                  <div className="row between" style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}><span className="muted" style={{ fontSize: 12.5 }}>Issuer</span><code style={{ fontSize: 11.5 }}>{s.oidc.issuer}</code></div>
                  <div className="row between" style={{ padding: "7px 0" }}><span className="muted" style={{ fontSize: 12.5 }}>Audience · JIT</span><b style={{ fontSize: 12.5 }}>{s.oidc.audience} · {s.oidc.jitProvision ? "oui" : "non"}</b></div>
                </>) : <p className="muted" style={{ fontSize: 12, margin: 0 }}>L'API accepte les jetons d'un IdP OIDC (Keycloak, Auth0, Azure AD) : configurez OIDC_ISSUER, OIDC_JWKS_URI et OIDC_AUDIENCE côté serveur.</p>}
              </div>
            </div>

            <div className="card">
              <div className="card-h"><h3>SCIM 2.0 (provisionnement SIRH)</h3><span className="pill pill--soft">{s.scim.organizations.filter((o) => o.tokenProvisioned).length}/{s.scim.organizations.length} client(s)</span></div>
              <div className="card-b" style={{ paddingTop: 4 }}>
                <UrlRow k="Endpoint SCIM" v={s.scim.baseUrl} />
                {s.scim.organizations.map((o) => (
                  <div key={o.id} className="row between" style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ fontSize: 13 }}><b>{o.name}</b> {o.tokenProvisioned ? <span className="pill pill--green" style={{ fontSize: 10, marginLeft: 6 }}>jeton actif</span> : <span className="pill pill--soft" style={{ fontSize: 10, marginLeft: 6 }}>sans jeton</span>}</span>
                    <button className="btn btn--sm" disabled={scimBusy === o.id} onClick={() => void provisionScim(o.id, o.name, o.tokenProvisioned)}>{scimBusy === o.id ? "…" : o.tokenProvisioned ? "↻ Régénérer" : "Générer un jeton"}</button>
                  </div>
                ))}
                {s.scim.organizations.length === 0 && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Aucune organisation — créez-en une dans « Entreprises & licences ».</p>}
                {scimToken && (
                  <div className="card" style={{ marginTop: 10, background: "var(--success-tint)", border: "none", padding: "11px 13px" }}>
                    <b style={{ fontSize: 12.5 }}>Jeton SCIM de {scimToken.org} (affiché une seule fois) :</b>
                    <code style={{ display: "block", fontSize: 11.5, wordBreak: "break-all", margin: "6px 0" }}>{scimToken.token}</code>
                    <span className="muted" style={{ fontSize: 11.5 }}>Endpoint : <code>{scimToken.endpoint}</code> · en-tête <code>Authorization: Bearer &lt;jeton&gt;</code></span>
                    <div style={{ marginTop: 8 }}><button className="btn btn--sm" onClick={() => navigator.clipboard?.writeText(scimToken.token)}>⧉ Copier le jeton</button></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>LTI 1.3 (lancement depuis un LMS)</h3><span className="pill pill--soft">{s.lti.platforms.length} plateforme(s)</span></div>
            <div className="card-b" style={{ paddingTop: 4 }}>
              <UrlRow k="Configuration outil" v={s.lti.configUrl} />
              <UrlRow k="JWKS de l'outil" v={s.lti.jwksUrl} />
              <UrlRow k="OIDC initiation" v={s.lti.oidcInitiationUrl} />
              <UrlRow k="Target link URI" v={s.lti.targetLinkUri} />
              <p className="muted" style={{ fontSize: 11.5, margin: "8px 0" }}>Donnez ces URLs au LMS consommateur (Moodle, Canvas…), puis enregistrez ci-dessous les informations qu'il vous fournit en retour.</p>

              {s.lti.platforms.length > 0 && (
                <table className="table" style={{ marginBottom: 8 }}>
                  <thead><tr><th>Plateforme</th><th>Issuer</th><th>Client ID</th><th>Créée</th></tr></thead>
                  <tbody>
                    {s.lti.platforms.map((p) => (
                      <tr key={p.id} style={{ cursor: "default" }}>
                        <td><b style={{ fontSize: 12.5 }}>{p.name ?? "—"}</b></td>
                        <td><code style={{ fontSize: 11 }}>{p.issuer}</code></td>
                        <td><code style={{ fontSize: 11 }}>{p.clientId}</code></td>
                        <td><span className="muted" style={{ fontSize: 12 }}>{ago(p.createdAt)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {ltiForm
                ? <LtiForm onDone={() => { setLtiForm(false); status.reload(); }} />
                : <button className="btn btn--sm" onClick={() => setLtiForm(true)}>+ Enregistrer une plateforme</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
