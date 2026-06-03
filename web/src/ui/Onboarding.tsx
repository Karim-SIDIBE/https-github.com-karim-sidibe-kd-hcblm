import { useEffect, useMemo, useState } from "react";
import { api, engine, store } from "../lib/app";
import { setCachedProgress } from "../lib/cache";
import { navigate, routes } from "../lib/router";

type Onboarding = {
  momentAncrage: { promptText: string; minChars: number; placeholderExample?: string };
  profileChoices: { key: string; name: string; description: string }[];
  triggerQuiz: { questions: { id: string; text: string; options: { key: string; label: string }[] }[] };
};
type Step = "pam" | "profile" | "peer" | "done";

/**
 * Onboarding (Block 0). Enforces the non-negotiable entry gates in order:
 * the PAM is the first interaction (AC#1), then profile + trigger quiz, then a
 * MANDATORY progress-peer designation (AC#5 / failure-mode 5 — no skip). All
 * steps queue offline and sync automatically.
 */
export function Onboarding({ eid }: { eid: string }) {
  const [payload, setPayload] = useState<Onboarding | null>(null);
  const [step, setStep] = useState<Step | null>(null);

  // PAM
  const [pam, setPam] = useState("");
  // profile + trigger
  const [profileKey, setProfileKey] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // peer
  const [peer, setPeer] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      const block0 = b?.content?.blocks?.find((x: any) => x.type === "ONBOARDING");
      if (alive && block0) setPayload(block0.payload);
      // Determine the first incomplete gate from live (or cached) progress.
      let pamDone = false, profileDone = false, triggerDone = false, peerDone = false;
      try {
        const d = await api.progress(eid);
        pamDone = Boolean(d.momentAncrageCaptured);
        const keys: string[] = d.progress?.blocks?.find((x: any) => x.index === 0)?.completedKeys ?? [];
        profileDone = keys.includes("profile"); triggerDone = keys.includes("trigger"); peerDone = keys.includes("peer");
      } catch { /* offline: start at PAM */ }
      if (!alive) return;
      setStep(!pamDone ? "pam" : (!triggerDone || !profileDone) ? "profile" : !peerDone ? "peer" : "done");
    })();
    return () => { alive = false; };
  }, [eid]);

  const minChars = payload?.momentAncrage.minChars ?? 50;
  const allAnswered = useMemo(
    () => (payload?.triggerQuiz.questions ?? []).every((q) => answers[q.id]),
    [payload, answers],
  );

  async function submitPam() {
    if (pam.trim().length < minChars) return;
    setBusy(true);
    try {
      await engine.commit(eid, "moment_ancrage", { text: pam.trim() });
      await engine.cacheBundle(eid); // re-inject PAM into the cached content
      setStep("profile");
    } finally { setBusy(false); }
  }

  async function submitProfile() {
    if (!profileKey || !allAnswered) return;
    setBusy(true);
    try {
      const r = await engine.commit(eid, "quiz_trigger", { answers, profileKey });
      if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
      setStep("peer");
    } finally { setBusy(false); }
  }

  async function submitPeer() {
    if (!peer.name.trim() || !/.+@.+\..+/.test(peer.email)) { setMsg("Indiquez un nom et un e-mail valides."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await engine.commit(eid, "peer", { name: peer.name.trim(), email: peer.email.trim(), phone: peer.phone.trim() || undefined });
      if ((r as any).progress) setCachedProgress(eid, (r as any).progress);
      setStep("done");
    } finally { setBusy(false); }
  }

  const Back = () => <button className="ghost" onClick={() => navigate(routes.course(eid))}>← Tableau de bord</button>;

  if (!payload || !step) return <div><Back /><div className="skeleton line" style={{ width: "60%" }} /><div className="skeleton card" /></div>;

  const stepNo = step === "pam" ? 1 : step === "profile" ? 2 : step === "peer" ? 3 : 3;

  return (
    <div className="stack">
      <Back />
      {step !== "done" && <p className="muted">Étape {stepNo} sur 3</p>}

      {step === "pam" && (
        <div className="card stack">
          <h1>Votre point de départ</h1>
          <p style={{ whiteSpace: "pre-wrap" }}>{payload.momentAncrage.promptText}</p>
          <textarea value={pam} onChange={(e) => setPam(e.target.value)} placeholder={payload.momentAncrage.placeholderExample || "Décrivez votre situation professionnelle réelle…"}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 200)} style={{ minHeight: 160 }} />
          <p className={`muted ${pam.trim().length >= minChars ? "ok" : ""}`} style={{ margin: 0, fontSize: 13 }}>
            {pam.trim().length} caractères · minimum {minChars}
          </p>
          <button className="block" disabled={busy || pam.trim().length < minChars} onClick={submitPam}>{busy ? "…" : "Enregistrer et continuer →"}</button>
        </div>
      )}

      {step === "profile" && (
        <div className="stack">
          <div className="card stack">
            <h2>Quel profil vous correspond le mieux ?</h2>
            {payload.profileChoices.map((p) => (
              <label key={p.key} className="row" style={{ margin: 0, alignItems: "flex-start", gap: 8 }}>
                <input type="radio" name="profile" style={{ width: "auto", marginTop: 4 }} checked={profileKey === p.key} onChange={() => setProfileKey(p.key)} />
                <span><strong>{p.name}</strong><br /><span className="muted">{p.description}</span></span>
              </label>
            ))}
          </div>
          {payload.triggerQuiz.questions.map((q) => (
            <div key={q.id} className="card stack">
              <strong>{q.text}</strong>
              {q.options.map((o) => (
                <label key={o.key} className="row" style={{ margin: 0, gap: 8 }}>
                  <input type="radio" name={q.id} style={{ width: "auto" }} checked={answers[q.id] === o.key} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          ))}
          <button className="block" disabled={busy || !profileKey || !allAnswered} onClick={submitProfile}>{busy ? "…" : "Continuer →"}</button>
        </div>
      )}

      {step === "peer" && (
        <div className="card stack">
          <h2>Votre pair de progression</h2>
          <p className="muted">Choisissez une personne qui sera informée de vos réussites. Cette étape est obligatoire — la responsabilisation sociale fait partie du parcours.</p>
          <label>Nom<input value={peer.name} onChange={(e) => setPeer({ ...peer, name: e.target.value })} placeholder="Nom du collègue / mentor" /></label>
          <label>E-mail<input value={peer.email} type="email" onChange={(e) => setPeer({ ...peer, email: e.target.value })} placeholder="email@exemple.com" /></label>
          <label>Téléphone (WhatsApp, optionnel)<input value={peer.phone} type="tel" onChange={(e) => setPeer({ ...peer, phone: e.target.value })} placeholder="+221…" /></label>
          {msg && <p className="ko" style={{ margin: 0 }}>{msg}</p>}
          <button className="block" disabled={busy} onClick={submitPeer}>{busy ? "…" : "Valider et débloquer le badge d'entrée"}</button>
        </div>
      )}

      {step === "done" && (
        <div className="card center stack">
          <p style={{ fontSize: 44, margin: 0 }}>🏅</p>
          <h1>Bloc 0 terminé</h1>
          <p className="muted">Votre badge d'entrée est débloqué. Vous pouvez commencer le parcours.</p>
          <button className="block" onClick={() => navigate(routes.course(eid))}>Aller au tableau de bord →</button>
        </div>
      )}
    </div>
  );
}
