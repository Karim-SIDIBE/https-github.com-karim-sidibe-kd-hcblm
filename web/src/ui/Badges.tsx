import { useEffect, useState } from "react";
import { api } from "../lib/app";
import { navigate, routes } from "../lib/router";

type Credential = { id: string; achievementType: string; badgeLabel: string; issuedAt: string; revoked: boolean; hostedUrl: string; verifyUrl: string };

const ORG = "Kompetences Declick";

/** LinkedIn "Add to profile" 1-tap deep link (AC#8). */
function linkedInUrl(c: Credential) {
  const d = new Date(c.issuedAt);
  const p = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: c.badgeLabel || c.achievementType,
    organizationName: ORG,
    issueYear: String(d.getFullYear()),
    issueMonth: String(d.getMonth() + 1),
    certUrl: c.hostedUrl,
    certId: c.id,
  });
  return `https://www.linkedin.com/profile/add?${p.toString()}`;
}

export function Badges({ eid }: { eid: string }) {
  const [creds, setCreds] = useState<Credential[] | null>(null);
  const [badges, setBadges] = useState<{ type: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, prog] = await Promise.all([api.get<Credential[]>(`/enrollments/${eid}/credentials`), api.progress(eid)]);
        if (!alive) return;
        setCreds(c ?? []);
        setBadges(prog?.badges ?? []);
      } catch { if (alive) setError("Connexion requise pour afficher vos badges."); }
    })();
    return () => { alive = false; };
  }, [eid]);

  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(null), 1500); } catch { /* */ }
  }

  const Back = () => <button className="ghost" onClick={() => navigate(routes.course(eid))}>← Tableau de bord</button>;

  return (
    <div className="stack">
      <Back />
      <h1>Mes badges & certificat</h1>
      {error && <p className="banner offline">{error}</p>}
      {!creds && !error && <><div className="skeleton card" /><div className="skeleton card" /></>}

      {creds && creds.length === 0 && badges.length === 0 && <p className="muted">Aucun badge pour le moment — terminez un bloc pour en débloquer un.</p>}

      {/* Earned block badges not yet credentialed (offline / pending issuance). */}
      {creds && creds.length === 0 && badges.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap" }}>{badges.map((b) => <span key={b.type} className="chip ok">🏅 {b.type}</span>)}</div>
      )}

      {(creds ?? []).map((c) => (
        <div key={c.id} className="card stack">
          <div className="row between">
            <strong>🏅 {c.badgeLabel || c.achievementType}</strong>
            {c.revoked ? <span className="chip ko">révoqué</span> : <span className="chip ok">vérifiable</span>}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Émis le {new Date(c.issuedAt).toLocaleDateString("fr-FR")}</p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <a href={linkedInUrl(c)} target="_blank" rel="noreferrer"><button>Ajouter à LinkedIn</button></a>
            <a href={c.verifyUrl} target="_blank" rel="noreferrer"><button className="secondary">Vérifier</button></a>
            <button className="secondary" onClick={() => copy(c.verifyUrl)}>{copied === c.verifyUrl ? "Copié ✓" : "Copier le lien"}</button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 12, wordBreak: "break-all" }}>{c.verifyUrl}</p>
        </div>
      ))}
    </div>
  );
}
