import { useEffect, useState } from "react";
import { api, engine, store } from "../lib/app";
import { navigate, routes } from "../lib/router";
import { brand } from "../lib/brand";

type Credential = { id: string; achievementType: string; badgeLabel: string; issuedAt: string; revoked: boolean; hostedUrl: string; verifyUrl: string };
const ORG = brand.issuer;
const TIERS = [
  { type: "ENTRY", abbr: "Entré", name: "Badge Entrée", block: "Bloc 0" },
  { type: "COMPREHENSION", abbr: "Compr", name: "Badge Compréhension", block: "Bloc 1" },
  { type: "PRACTICE", abbr: "Prati", name: "Badge Pratique", block: "Bloc 2" },
  { type: "ANCHORING", abbr: "Ancra", name: "Badge Ancrage", block: "Bloc 3" },
];
const LEVELS: Record<string, string> = { L1: "Niveau 1", L2: "Niveau 2", L3: "Niveau 3", N1: "Niveau 1", N2: "Niveau 2", N3: "Niveau 3" };

function linkedInUrl(c: Credential) {
  const d = new Date(c.issuedAt);
  const p = new URLSearchParams({ startTask: "CERTIFICATION_NAME", name: c.badgeLabel || c.achievementType, organizationName: ORG, issueYear: String(d.getFullYear()), issueMonth: String(d.getMonth() + 1), certUrl: c.hostedUrl, certId: c.id });
  return `https://www.linkedin.com/profile/add?${p.toString()}`;
}

export function Badges({ eid }: { eid: string }) {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [badges, setBadges] = useState<{ type: string }[]>([]);
  const [completed, setCompleted] = useState(false);
  const [level, setLevel] = useState("Niveau 1");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      if (alive && b?.course?.level) setLevel(LEVELS[b.course.level] ?? b.course.level);
      try {
        const [c, prog] = await Promise.all([api.get<Credential[]>(`/enrollments/${eid}/credentials`), api.progress(eid)]);
        if (!alive) return;
        setCreds(c ?? []); setBadges(prog?.badges ?? []); setCompleted(Boolean(prog?.progress?.courseCompleted));
      } catch { /* offline */ }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [eid]);

  const credFor = (type: string) => creds.find((c) => c.achievementType === type || c.badgeLabel === type);
  const has = (type: string) => badges.some((b) => b.type === type);
  const cert = creds.find((c) => c.achievementType === "CERTIFICATE" || /CERT/i.test(c.achievementType));

  return (
    <div className="stack">
      <div><div className="eyebrow">Vos badges</div><h1 style={{ marginTop: 6 }}>Progression certifiante</h1></div>
      {!loaded && <><div className="skeleton card" /><div className="skeleton card" /></>}

      {TIERS.map((t) => {
        const earned = has(t.type); const c = credFor(t.type);
        return (
          <div key={t.type} className="hf-card" style={earned ? undefined : { opacity: 0.7 }}>
            <div className="row between">
              <div className="row" style={{ gap: 14 }}>
                <span className={`hf-medal ${earned ? "earned" : ""}`}>{t.abbr}</span>
                <div><strong className="h4">{t.name}</strong><div className="meta">{t.block}</div></div>
              </div>
              {earned ? <span className="hf-pill hf-pill--mint hf-pill--sm">Obtenu</span> : <span className="hf-lock">🔒 Verrouillé</span>}
            </div>
            {earned && c && !c.revoked && (
              <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
                <a href={linkedInUrl(c)} target="_blank" rel="noreferrer"><button className="hf-btn hf-btn--sm hf-btn--primary">Ajouter à LinkedIn</button></a>
                <a href={c.verifyUrl} target="_blank" rel="noreferrer"><button className="hf-btn hf-btn--sm hf-btn--outline">Vérifier</button></a>
              </div>
            )}
          </div>
        );
      })}

      {/* Certificate */}
      <div className="hf-card hf-card--peach hf-card--stripe-orange center">
        <span className="hf-medal cert lg" style={{ margin: "0 auto" }}>{level}</span>
        <h2 style={{ marginTop: 12 }}>Certificat de {level}</h2>
        {completed && cert ? (
          <div className="row" style={{ justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
            <a href={linkedInUrl(cert)} target="_blank" rel="noreferrer"><button className="hf-btn hf-btn--sm hf-btn--primary">Ajouter à LinkedIn</button></a>
            <a href={cert.verifyUrl} target="_blank" rel="noreferrer"><button className="hf-btn hf-btn--sm hf-btn--outline">Vérification publique</button></a>
          </div>
        ) : (
          <button className="hf-btn hf-btn--outline" style={{ marginTop: 8 }} onClick={() => navigate(routes.project(eid))}>Déposer mon projet du Bloc 4 →</button>
        )}
      </div>
    </div>
  );
}
