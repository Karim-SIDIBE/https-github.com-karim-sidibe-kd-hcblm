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
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid));
      if (alive) setBundle(b);
    })();
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
        <div className="card stack">
          <h2>Votre profil de compétence</h2>
          {band && <p className="chip ok" style={{ alignSelf: "flex-start" }}>{band.name}</p>}
          {band?.description && <p className="muted">{band.description}</p>}
          <p style={{ marginBottom: 0 }}><strong>Vos 2 priorités d'apprentissage :</strong></p>
          <div className="stack">
            {prof.priorities.map((p, i) => <div key={p} className="card" style={{ margin: 0, borderLeft: "4px solid var(--brand)" }}><strong>{i + 1}. {p}</strong></div>)}
          </div>
          <p className="muted" style={{ fontSize: 13 }}>Score : {prof.correct}/{prof.total}</p>
        </div>
      ) });
    } else if (kind === "final") {
      const s = scoreQuiz(data!.raw, answers);
      const passed = s.scorePct >= (data!.threshold ?? 70);
      setResult({ node: (
        <div className="card center stack">
          <p style={{ fontSize: 40, margin: 0 }}>{passed ? "🎉" : "💪"}</p>
          <h2>{passed ? "Quiz final réussi !" : "Pas encore atteint"}</h2>
          <p className={`chip ${passed ? "ok" : "ko"}`} style={{ alignSelf: "center" }}>{s.scorePct}% · seuil {data!.threshold ?? 70}%</p>
          <p className="muted">{passed ? "Le bloc de certification est débloqué." : "Reprenez les sessions du bloc puis retentez."}</p>
        </div>
      ) });
    } else {
      const s = scoreQuiz(data!.raw, answers);
      setResult({ node: <div className="card center stack"><h2>Consolidation terminée</h2><p className="chip ok" style={{ alignSelf: "center" }}>{s.correct}/{s.total} bonnes réponses</p></div> });
    }
  }

  const Back = () => <button className="ghost" onClick={() => navigate(routes.course(eid))}>← Tableau de bord</button>;
  if (!bundle) return <div><Back /><div className="skeleton line" style={{ width: "50%" }} /><div className="skeleton card" /></div>;
  if (!data) return <div><Back /><p className="banner offline">Quiz indisponible.</p></div>;

  return (
    <div className="stack">
      <Back />
      <h1>{cfg.title}</h1>
      {result ? (
        <>
          {result.node}
          <button className="block" onClick={() => navigate(routes.course(eid))}>Continuer →</button>
        </>
      ) : (
        <Quiz questions={data.questions} onSubmit={onSubmit} />
      )}
    </div>
  );
}
