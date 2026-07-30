import { useEffect, useState } from "react";
import { api, engine, store } from "../lib/app";
import { navigate, routes } from "../lib/router";
import { brand } from "../lib/brand";
import { useT, useI18n } from "../lib/i18n";

type Credential = { id: string; achievementType: string; badgeLabel: string; issuedAt: string; revoked: boolean; hostedUrl: string; verifyUrl: string };
type TranscriptRow = { key: string; label: string; scorePct: number | null; correct: number | null; total: number | null; scored: boolean; at: string };
const ORG = brand.issuer;
// Symbol of each block badge (consigne « Amélioration » — 2e point).
const SYMBOL: Record<string, string> = { ENTRY: "🔑", COMPREHENSION: "🧠", PRACTICE: "💪", ANCHORING: "⚓" };
const TIERS = [
  { type: "ENTRY", nameKey: "bd.entry", block: 0 },
  { type: "COMPREHENSION", nameKey: "bd.comprehension", block: 1 },
  { type: "PRACTICE", nameKey: "bd.practice", block: 2 },
  { type: "ANCHORING", nameKey: "bd.anchoring", block: 3 },
];

function linkedInUrl(c: Credential) {
  const d = new Date(c.issuedAt);
  const p = new URLSearchParams({ startTask: "CERTIFICATION_NAME", name: c.badgeLabel || c.achievementType, organizationName: ORG, issueYear: String(d.getFullYear()), issueMonth: String(d.getMonth() + 1), certUrl: c.hostedUrl, certId: c.id });
  return `https://www.linkedin.com/profile/add?${p.toString()}`;
}

export function Badges({ eid }: { eid: string }) {
  const t = useT();
  const { lang } = useI18n();
  const levelLabel = (l: string) => { const n = l.replace(/\D/g, ""); return n === "1" || n === "2" || n === "3" ? t(`level.${n}`) : l; };
  const [creds, setCreds] = useState<Credential[]>([]);
  const [badges, setBadges] = useState<{ type: string }[]>([]);
  const [transcript, setTranscript] = useState<TranscriptRow[]>([]);
  const [completed, setCompleted] = useState(false);
  const [level, setLevel] = useState("N1");
  const [loaded, setLoaded] = useState(false);
  const [dl, setDl] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      if (alive && b?.course?.level) setLevel(b.course.level);
      try {
        const [c, prog, tr] = await Promise.all([
          api.get<Credential[]>(`/enrollments/${eid}/credentials`),
          api.progress(eid),
          api.get<{ rows: TranscriptRow[] }>(`/enrollments/${eid}/transcript`).catch(() => null),
        ]);
        if (!alive) return;
        setCreds(c ?? []); setBadges(prog?.badges ?? []); setCompleted(Boolean(prog?.progress?.courseCompleted));
        setTranscript(tr?.rows ?? []);
      } catch { /* offline */ }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [eid]);

  const credFor = (type: string) => creds.find((c) => c.achievementType === type || c.badgeLabel === type);
  const has = (type: string) => badges.some((b) => b.type === type);
  const cert = creds.find((c) => c.achievementType === "CERTIFICATE" || /CERT/i.test(c.achievementType));

  // « Télécharger » : the certificate PDF, fetched with the session token.
  async function downloadPdf(c: Credential) {
    setDl(true);
    try {
      const res = await api.raw("GET", `/credentials/${c.id}/certificate.pdf`, { auth: true });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `certification-${levelLabel(level).replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* offline / error — button stays */ } finally { setDl(false); }
  }

  const dateFmt = (s: string) => new Date(s).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR");

  return (
    <div className="stack">
      <div><div className="eyebrow">{t("bd.eyebrow")}</div><h1 style={{ marginTop: 6 }}>{t("bd.title")}</h1></div>
      {!loaded && <><div className="skeleton card" /><div className="skeleton card" /></>}

      {/* Block badges — milestones, distinct from the final certification. */}
      <div className="eyebrow">{t("bd.blockBadges")}</div>
      {TIERS.map((tier) => {
        const earned = has(tier.type); const c = credFor(tier.type);
        return (
          <div key={tier.type} className="hf-card" style={earned ? undefined : { opacity: 0.7 }}>
            <div className="row between">
              <div className="row" style={{ gap: 14 }}>
                <span className={`hf-medal ${earned ? "earned" : ""}`} style={{ fontSize: 22 }}>{SYMBOL[tier.type]}</span>
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

      {/* Final certification — the only deliverable called « Certification ». */}
      <div className="eyebrow" style={{ marginTop: 6 }}>{t("bd.finalCert")}</div>
      <div className="hf-card hf-card--peach hf-card--stripe-orange center">
        <span className="hf-medal cert lg" style={{ margin: "0 auto" }}>{levelLabel(level)}</span>
        <h2 style={{ marginTop: 12 }}>{t("bd.certOf", { level: levelLabel(level) })}</h2>
        <p className="meta" style={{ margin: "4px 0 0" }}>{t("bd.certNote")}</p>
        {completed && cert ? (
          <div className="row" style={{ justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
            <button className="hf-btn hf-btn--sm hf-btn--primary" disabled={dl} onClick={() => void downloadPdf(cert)}>{dl ? "…" : t("bd.download")}</button>
            <a href={linkedInUrl(cert)} target="_blank" rel="noreferrer"><button className="hf-btn hf-btn--sm hf-btn--outline">{t("bd.addLinkedIn")}</button></a>
            <a href={cert.verifyUrl} target="_blank" rel="noreferrer"><button className="hf-btn hf-btn--sm hf-btn--outline">{t("bd.publicVerify")}</button></a>
          </div>
        ) : (
          <button className="hf-btn hf-btn--outline" style={{ marginTop: 8 }} onClick={() => navigate(routes.project(eid))}>{t("bd.submitProject")}</button>
        )}
      </div>

      {/* Transcript — every scored quiz and graded activity. */}
      {transcript.length > 0 && (
        <div className="hf-card stack">
          <strong className="h4">{t("bd.transcript")}</strong>
          <div className="stack" style={{ gap: 6 }}>
            {transcript.map((r) => (
              <div key={r.key} className="row between" style={{ gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="body" style={{ minWidth: 0 }}>{r.label}<span className="meta"> · {dateFmt(r.at)}</span></span>
                <span className={`hf-pill hf-pill--sm ${r.scored ? (r.scorePct != null && r.scorePct >= 70 ? "hf-pill--mint" : "hf-pill--orange") : "hf-pill--soft"}`} style={{ whiteSpace: "nowrap" }}>
                  {r.scorePct != null ? `${r.scorePct} %` : r.correct != null && r.total != null ? `${r.correct}/${r.total}` : "—"}
                  {!r.scored ? ` · ${t("bd.notGraded")}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
