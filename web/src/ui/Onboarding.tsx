import { useEffect, useMemo, useState } from "react";
import { api, engine, store } from "../lib/app";
import { setCachedProgress } from "../lib/cache";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

type Onboarding = {
  momentAncrage: { promptText: string; minChars: number; placeholderExample?: string };
  profileChoices: { key: string; name: string; description: string }[];
  triggerQuiz: { questions: { id: string; text: string; options: { key: string; label: string }[] }[] };
};
type Step = "pam" | "profile" | "peer" | "done";

/**
 * Onboarding (Block 0). Enforces the non-negotiable entry gates in order:
 * PAM first (AC#1), then profile + trigger quiz, then a MANDATORY progress-peer
 * (AC#5 / failure-mode 5 — no skip). Styled with the hf-* kit.
 */
export function Onboarding({ eid }: { eid: string }) {
  const t = useT();
  const [payload, setPayload] = useState<Onboarding | null>(null);
  const [objective, setObjective] = useState("");
  const [step, setStep] = useState<Step | null>(null);
  const [pam, setPam] = useState("");
  const [profileKey, setProfileKey] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [peer, setPeer] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      const block0 = b?.content?.blocks?.find((x: any) => x.type === "ONBOARDING");
      if (alive && block0) setPayload(block0.payload);
      if (alive) setObjective(b?.content?.objective ?? "");
      let pamDone = false, profileDone = false, triggerDone = false, peerDone = false;
      try {
        const d = await api.progress(eid);
        pamDone = Boolean(d.momentAncrageCaptured);
        const keys: string[] = d.progress?.blocks?.find((x: any) => x.index === 0)?.completedKeys ?? [];
        profileDone = keys.includes("profile"); triggerDone = keys.includes("trigger"); peerDone = keys.includes("peer");
      } catch { /* offline */ }
      if (!alive) return;
      setStep(!pamDone ? "pam" : (!triggerDone || !profileDone) ? "profile" : !peerDone ? "peer" : "done");
    })();
    return () => { alive = false; };
  }, [eid]);

  const minChars = payload?.momentAncrage.minChars ?? 50;
  const allAnswered = useMemo(() => (payload?.triggerQuiz.questions ?? []).every((q) => answers[q.id]), [payload, answers]);

  async function submitPam() {
    if (pam.trim().length < minChars) return;
    setBusy(true);
    try { await engine.commit(eid, "moment_ancrage", { text: pam.trim() }); await engine.cacheBundle(eid); setStep("profile"); } finally { setBusy(false); }
  }
  async function submitProfile() {
    if (!profileKey || !allAnswered) return;
    setBusy(true);
    try { const r = await engine.commit(eid, "quiz_trigger", { answers, profileKey }); if ((r as any).progress) setCachedProgress(eid, (r as any).progress); setStep("peer"); } finally { setBusy(false); }
  }
  async function submitPeer() {
    if (!peer.name.trim() || !/.+@.+\..+/.test(peer.email)) { setMsg(t("ob.invalidPeer")); return; }
    setBusy(true); setMsg(null);
    try { const r = await engine.commit(eid, "peer", { name: peer.name.trim(), email: peer.email.trim() }); if ((r as any).progress) setCachedProgress(eid, (r as any).progress); setStep("done"); } finally { setBusy(false); }
  }

  const Back = () => <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0 }} onClick={() => navigate(routes.course(eid))}>← {t("nav.home")}</button>;
  if (!payload || !step) return <div className="stack"><Back /><div className="skeleton line" style={{ width: "60%" }} /><div className="skeleton card" /></div>;
  const stepNo = step === "pam" ? 1 : step === "profile" ? 2 : 3;

  return (
    <div className="stack">
      <Back />
      {step !== "done" && (<>
        <div className="eyebrow">{t("ob.step", { n: stepNo })}</div>
        <div className="hf-prog"><i style={{ width: `${(stepNo / 3) * 100}%` }} /></div>
      </>)}

      {step === "pam" && (
        <div className="hf-card stack">
          <h1>{t("ob.startingPoint")}</h1>
          <div className="hf-pam"><span className="tag">{t("ob.pamTag")}</span><div className="quote" style={{ whiteSpace: "pre-wrap" }}>{payload.momentAncrage.promptText}</div></div>
          <div className="hf-textwrap">
            <textarea className="hf-field" value={pam} onChange={(e) => setPam(e.target.value)} placeholder={payload.momentAncrage.placeholderExample || t("ob.pamPlaceholder")}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} style={{ minHeight: 160 }} />
            <span className="hf-count" style={{ color: pam.trim().length >= minChars ? "var(--brand-declick)" : undefined }}>{pam.trim().length} / {minChars}</span>
          </div>
          <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy || pam.trim().length < minChars} onClick={submitPam}>{busy ? "…" : t("ob.saveContinue")}</button>
        </div>
      )}

      {step === "profile" && objective && (
        <div className="hf-card hf-card--icy stack">
          <div className="eyebrow">{t("ob.objective")}</div>
          <p className="body" style={{ margin: 0 }}>{objective}</p>
        </div>
      )}

      {step === "profile" && (
        <div className="stack">
          <div className="hf-card stack">
            <h3>{t("ob.whichProfile")}</h3>
            {payload.profileChoices.map((p) => (
              <div key={p.key} className={`pt-opt ${profileKey === p.key ? "sel" : ""}`} role="button" onClick={() => setProfileKey(p.key)}>
                <strong className="h4">{p.name}</strong><div className="meta">{p.description}</div>
              </div>
            ))}
          </div>
          {payload.triggerQuiz.questions.map((q) => (
            <div key={q.id} className="hf-card stack">
              <strong className="h4">{q.text}</strong>
              {q.options.map((o) => (
                <div key={o.key} className={`pt-opt ${answers[q.id] === o.key ? "sel" : ""}`} role="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}>
                  <span className="body" style={{ color: "var(--fg-1)" }}>{o.label}</span>
                </div>
              ))}
            </div>
          ))}
          <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy || !profileKey || !allAnswered} onClick={submitProfile}>{busy ? "…" : t("ob.continue")}</button>
        </div>
      )}

      {step === "peer" && (
        <div className="hf-card stack">
          <h3>{t("ob.peerTitle")}</h3>
          <p className="body">{t("ob.peerDescPre")}<strong>{t("ob.peerMandatory")}</strong>{t("ob.peerDescPost")}</p>
          <label>{t("ob.name")}<input className="hf-field" value={peer.name} onChange={(e) => setPeer({ ...peer, name: e.target.value })} placeholder={t("ob.namePh")} /></label>
          <label>{t("ob.email")}<input className="hf-field" value={peer.email} type="email" onChange={(e) => setPeer({ ...peer, email: e.target.value })} placeholder={t("ob.emailPh")} /></label>
          {msg && <p className="ko" style={{ margin: 0 }}>{msg}</p>}
          <button className="hf-btn hf-btn--primary hf-btn--block" disabled={busy} onClick={submitPeer}>{busy ? "…" : t("ob.validate")}</button>
        </div>
      )}

      {step === "done" && (
        <div className="hf-card hf-card--peach hf-card--stripe-orange center stack">
          <span className="hf-medal earned lg" style={{ margin: "0 auto" }}>{t("ob.medal")}</span>
          <h1>{t("ob.doneTitle")}</h1>
          <p className="body">{t("ob.doneDesc")}</p>
          <button className="hf-btn hf-btn--primary hf-btn--block" onClick={() => navigate(routes.cours(eid))}>{t("ob.startCourse")}</button>
        </div>
      )}
    </div>
  );
}
