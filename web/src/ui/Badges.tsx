import { useEffect, useState } from "react";
import { api, engine, store } from "../lib/app";
import { navigate, routes } from "../lib/router";
import { brand } from "../lib/brand";
import { useT } from "../lib/i18n";

type Credential = { id: string; achievementType: string; badgeLabel: string; issuedAt: string; revoked: boolean; hostedUrl: string; verifyUrl: string };
const ORG = brand.issuer;
const TIERS = [
  { type: "ENTRY", abbr: "Entré", nameKey: "bd.entry", block: 0 },
  { type: "COMPREHENSION", abbr: "Compr", nameKey: "bd.comprehension", block: 1 },
  { type: "PRACTICE", abbr: "Prati", nameKey: "bd.practice", block: 2 },
  { type: "ANCHORING", abbr: "Ancra", nameKey: "bd.anchoring", block: 3 },
];

function linkedInUrl(c: Credential) {
  const d = new Date(c.issuedAt);
  const p = new URLSearchParams({ startTask: "CERTIFICATION_NAME", name: c.badgeLabel || c.achievementType, organizationName: ORG, issueYear: String(d.getFullYear()), issueMonth: String(d.getMonth() + 1), certUrl: c.hostedUrl, certId: c.id });
  return `https://www.linkedin.com/profile/add?${p.toString()}`;
}

export function Badges({ eid }: { eid: string }) {
  const t = useT();
  const levelLabel = (l: string) => { const n = l.replace(/\D/g, ""); return n === "1" || n === "2" || n === "3" ? t(`level.${n}`) : l; };
  const [creds, setCreds] = useState<Credential[]>([]);
  const [badges, setBadges] = useState<{ type: string }[]>([]);
  const [completed, setCompleted] = useState(false);
  const [level, setLevel] = useState("N1");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      if (alive && b?.course?.level) setLevel(b.course.level);
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
      <div><div className="eyebrow">{t("bd.eyebrow")}</div><h1 style={{ marginTop: 6 }}>{t("bd.title")}</h1></div>
      {!loaded && <><div className="skeleton card" /><div className="skeleton card" /></>}

      {TIERS.map((tier) => {
        const earned = has(tier.type); const c = credFor(tier.type);
        return (
          <div key={tier.type} className="hf-card" style={earned ? undefined : { opacity: 0.7 }}>
            <div className="row between">
              <div className="row" style={{ gap: 14 }}>
                <span className={`hf-medal ${earned ? "earned" : ""}`}>{tier.abbr}</span>
                <div><strong className="h4">{t(tier.nameKey)}</strong><div className="meta">{t("home.block", { n: tier.block })}</div></div>
              </div>
              {earned ? <span className="hf-pill hf-pill--mint hf-pill--sm">{t("bd.obtained")}</span> : <span className="hf-lock">{t("course.state.locked")}</span>}
            </div>
            {earned && c && !c.revoked && (
              <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
                <a href={linkedInUrl(c)} target="_blank" rel="noreferrer"><button className="hf-btn hf-btn--sm hf-btn--primary">{t("bd.addLinkedIn")}</button></a>
                <a href={c.verifyUrl} target="_blank" rel="noreferrer"><button className="hf-btn hf-btn--sm hf-btn--outline">{t("bd.verify")}</button></a>
              </div>
            )}
          </div>
        );
      })}

      {/* Certificate */}
      <div className="hf-card hf-card--peach hf-card--stripe-orange center">
        <span className="hf-medal cert lg" style={{ margin: "0 auto" }}>{levelLabel(level)}</span>
        <h2 style={{ marginTop: 12 }}>{t("bd.certOf", { level: levelLabel(level) })}</h2>
        {completed && cert ? (
          <div className="row" style={{ justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
            <a href={linkedInUrl(cert)} target="_blank" rel="noreferrer"><button className="hf-btn hf-btn--sm hf-btn--primary">{t("bd.addLinkedIn")}</button></a>
            <a href={cert.verifyUrl} target="_blank" rel="noreferrer"><button className="hf-btn hf-btn--sm hf-btn--outline">{t("bd.publicVerify")}</button></a>
          </div>
        ) : (
          <button className="hf-btn hf-btn--outline" style={{ marginTop: 8 }} onClick={() => navigate(routes.project(eid))}>{t("bd.submitProject")}</button>
        )}
      </div>
    </div>
  );
}
