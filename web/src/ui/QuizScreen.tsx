import { useEffect, useMemo, useState } from "react";
import { engine, store } from "../lib/app";
import { setCachedProgress } from "../lib/cache";
import { diagnosticProfile, scoreQuiz, type ScoredQuestion } from "../lib/quiz";
import { navigate, routes, type QuizKind } from "../lib/router";
import { Quiz, type QuizQuestion, type QuestionMeta } from "./Quiz";

const CFG: Record<QuizKind, { blockType: string; source: string; action: string; title: string }> = {
  diagnostic: { blockType: "COMPREHENSION", source: "diagnosticQuiz", action: "quiz_diagnostic", title: "Quiz diagnostique" },
  interblock: { blockType: "PRACTICE", source: "interBlockQuiz", action: "quiz_interblock", title: "Quiz interbloc" },
  final: { blockType: "ANCHORING", source: "finalQuiz", action: "quiz_final", title: "Quiz final" },
};
const diagKey = (eid: string) => `klms_diag_${eid}`;

export function QuizScreen({ eid, kind }: { eid: string; kind: QuizKind }) {
  const cfg = CFG[kind];
  const [bundle, setBundle] = useState<any>(null);
  const [result, setResult] = useState<null | { node: JSX.Element }>(null);

  useEffect(() => {
    let alive = true;
    (async () => { const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid)); if (alive) setBundle(b); })();
    return () => { alive = false; };
  }, [eid]);

  const data = useMemo(() => {
    const block = bundle?.content?.blocks?.find((x: any) => x.type === cfg.blockType);
    const src = block?.payload?.[cfg.source];
    if (!src?.questions?.length) return null;
    const raw: ScoredQuestion[] = src.questions;
    const questions: QuizQuestion[] = raw.map((q: any) => ({ id: q.id, prompt: q.scenarioText ?? q.text, options: q.options, correctKey: q.correctKey, feedbackText: q.feedbackText }));
    return { block, src, raw, questions, threshold: block?.payload?.finalQuiz?.passThreshold as number | undefined, profiles: src.profiles as any[] | undefined };
  }, [bundle, cfg]);

  async function onSubmit(answers: Record<string, string>, meta: QuestionMeta) {
    const r = await engine.commit(eid, cfg.action, { answers, meta });
    if ((r as any).progress) setCachedProgress(eid, (r as any).progress);

    if (kind === "diagnostic") {
      const prof = diagnosticProfile(data!.raw, answers);
      const band = (data!.profiles ?? []).find((p: any) => prof.correct >= p.scoreRange[0] && prof.correct <= p.scoreRange[1]);
      try { localStorage.setItem(diagKey(eid), JSON.stringify({ priorities: prof.priorities, profile: band?.name ?? null })); } catch { /* */ }
      setResult({ node: (
        <div className="hf-card hf-card--stripe-orange stack pt-reveal">
          <div className="eyebrow">Votre profil de compétence</div>
          {band && <span className="hf-pill hf-pill--mint" style={{ alignSelf: "flex-start" }}>{band.name}</span>}
          {band?.description && <p className="body">{band.description}</p>}
          <strong className="h4">Vos 2 priorités d'apprentissage</strong>
          <div className="stack">
            {prof.priorities.map((p, i) => (
              <div key={p} className="hf-card hf-card--peach row" style={{ gap: 12, padding: 14 }}>
                <span className="hf-medal cert" style={{ width: 36, height: 36, fontSize: 14 }}>{i + 1}</span>
                <strong className="h4">{p}</strong>
              </div>
            ))}
          </div>
          <p className="meta">Score : {prof.correct}/{prof.total}</p>
        </div>
      ) });
    } else if (kind === "final") {
      const s = scoreQuiz(data!.raw, answers);
      const passed = s.scorePct >= (data!.threshold ?? 70);
      setResult({ node: (
        <div className="hf-card center stack pt-reveal">
          <p style={{ fontSize: 44, margin: 0 }}>{passed ? "🎉" : "💪"}</p>
          <h2>{passed ? "Quiz final réussi !" : "Pas encore atteint"}</h2>
          <span className={`hf-pill ${passed ? "hf-pill--mint" : "hf-pill--orange"}`} style={{ alignSelf: "center" }}>{s.scorePct}% · seuil {data!.threshold ?? 70}%</span>
          <p className="body">{passed ? "Le bloc de certification est débloqué." : "Reprenez les sessions du bloc puis retentez."}</p>
        </div>
      ) });
    } else {
      const s = scoreQuiz(data!.raw, answers);
      setResult({ node: <div className="hf-card center stack pt-reveal"><h2>Consolidation terminée</h2><span className="hf-pill hf-pill--mint" style={{ alignSelf: "center" }}>{s.correct}/{s.total} bonnes réponses</span></div> });
    }
  }

  const Back = () => <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0 }} onClick={() => navigate(routes.cours(eid))}>← Le parcours</button>;
  if (!bundle) return <div className="stack"><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;
  if (!data) return <div className="stack"><Back /><p className="banner offline">Quiz indisponible.</p></div>;

  return (
    <div className="stack">
      <Back />
      <h1>{cfg.title}</h1>
      {result ? (
        <>
          {result.node}
          <button className="hf-btn hf-btn--primary hf-btn--block" onClick={() => navigate(routes.cours(eid))}>Continuer →</button>
        </>
      ) : (
        <Quiz questions={data.questions} onSubmit={onSubmit} />
      )}
    </div>
  );
}
