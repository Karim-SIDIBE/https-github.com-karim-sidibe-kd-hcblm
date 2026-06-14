import { useEffect, useState } from "react";
import { api, getIdentity, logout } from "../lib/app";
import { routes } from "../lib/router";
import type { ConsentState } from "../lib/api";

/** Learner self-service: consents, data export, account deletion (RGPD). */
export function Account() {
  const me = getIdentity();
  const [consents, setConsents] = useState<ConsentState[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => api.consents().then(setConsents).catch((e) => setErr(e?.message || "Erreur"));
  useEffect(() => { void load(); }, []);

  async function toggle(type: string, granted: boolean) {
    setErr(null); setMsg(null);
    try { await api.setConsent(type, granted); void load(); } catch (e: any) { setErr(e?.message || "Erreur"); }
  }

  async function exportData() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const text = await api.exportMyData();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      a.download = "mes-donnees.json"; a.click(); URL.revokeObjectURL(a.href);
      setMsg("Vos données ont été téléchargées (mes-donnees.json).");
    } catch (e: any) { setErr(e?.message || "Erreur"); } finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!confirm("Supprimer votre compte ?\n\nIl sera bloqué immédiatement, puis effacé après un délai de grâce de 30 jours. Contactez le support avant cette date pour annuler.")) return;
    setBusy(true); setErr(null);
    try {
      await api.deleteAccount("anonymize");
      logout();
      alert("Votre compte a été programmé pour suppression. Vous êtes maintenant déconnecté.");
      location.hash = "#/"; location.reload();
    } catch (e: any) { setErr(e?.message || "Erreur"); setBusy(false); }
  }

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR") : "");

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
      <a href={routes.enrollments()} style={{ fontSize: 14 }}>← Retour</a>
      <h1 style={{ marginTop: 8 }}>Mon compte &amp; confidentialité</h1>
      {me && <p className="muted">{me.name} · {me.email}</p>}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Mes consentements</h3>
        {!consents ? <p className="muted">Chargement…</p> : consents.map((c) => (
          <div key={c.type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line, #eee)" }}>
            <div>
              <strong style={{ fontSize: 14 }}>{c.label}{c.required && <span className="muted"> (requis)</span>}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{c.granted ? `Accepté${c.grantedAt ? " le " + fmt(c.grantedAt) : ""} · v${c.acceptedVersion}` : "Non accepté"}</div>
            </div>
            {c.required
              ? <span style={{ fontSize: 16 }}>{c.granted ? "✓" : "—"}</span>
              : <input type="checkbox" checked={c.granted} onChange={(e) => toggle(c.type, e.target.checked)} style={{ width: 20, height: 20 }} />}
          </div>
        ))}
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Les consentements requis ne peuvent être retirés ici : cela reviendrait à supprimer le compte.</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Mes données</h3>
        <p className="muted" style={{ fontSize: 13 }}>Téléchargez une copie de toutes vos données (profil, progression, journal…) au format JSON — droit d'accès et portabilité.</p>
        <button disabled={busy} onClick={exportData}>{busy ? "…" : "⬇ Exporter mes données"}</button>
      </div>

      <div className="card" style={{ marginTop: 16, borderColor: "var(--ko, #c0392b)" }}>
        <h3>Supprimer mon compte</h3>
        <p className="muted" style={{ fontSize: 13 }}>Votre compte sera bloqué immédiatement puis effacé après 30 jours. Réversible pendant ce délai via le support.</p>
        <button disabled={busy} onClick={deleteAccount} style={{ color: "var(--ko, #c0392b)", borderColor: "var(--ko, #c0392b)" }}>Supprimer mon compte</button>
      </div>

      {msg && <p className="ok" style={{ marginTop: 12 }}>{msg}</p>}
      {err && <p className="ko" style={{ marginTop: 12 }}>{err}</p>}
    </div>
  );
}
