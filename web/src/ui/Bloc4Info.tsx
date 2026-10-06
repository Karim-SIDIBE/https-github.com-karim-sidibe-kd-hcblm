import { useEffect, useMemo, useState } from "react";
import { engine, store } from "../lib/app";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";
import { RubricCard, type RubricSpec } from "./RubricCard";

/** Pages d'information permanentes du menu (consigne du 06/10/2026) : savoir à
 *  tout moment ce qui attend l'apprenant au Bloc 4 et comment il sera évalué
 *  aide à mieux aborder chaque bloc et à mesurer l'impact de chaque action.
 *  Tout vient du contenu du parcours (bundle hors-ligne) — zéro texte dupliqué. */

type CertBlock = {
  payload: {
    projectBrief: string;
    sections: { title: string; helpText?: string; durationEstimate?: string }[];
    journal: { entries: { day: number; minWords?: number }[] };
    rubric: RubricSpec;
    evaluation?: { turnaroundDays?: number };
  };
};

function useCertBlock(eid: string): CertBlock | null | undefined {
  const [bundle, setBundle] = useState<any>(undefined);
  useEffect(() => {
    let alive = true;
    (async () => {
      const b = (await store.getBundle<any>(eid)) ?? (await engine.cacheBundle(eid).catch(() => null));
      if (alive) setBundle(b ?? null);
    })();
    return () => { alive = false; };
  }, [eid]);
  return useMemo(() => {
    if (bundle === undefined) return undefined; // chargement
    const blk = bundle?.content?.blocks?.find((x: any) => x.type === "CERTIFICATION");
    return (blk as CertBlock) ?? null;
  }, [bundle]);
}

const Back = ({ eid, t }: { eid: string; t: (k: string) => string }) => (
  <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0, alignSelf: "flex-start" }} onClick={() => navigate(routes.course(eid))}>← {t("nav.home")}</button>
);

/** « Qu'est-ce qui vous attend au Bloc 4 » — mission, les 5 sections, la
 *  cadence du journal, la règle d'assemblage (EN GRAS — consigne du
 *  06/10/2026) et le circuit d'évaluation. */
export function Bloc4Info({ eid }: { eid: string }) {
  const t = useT();
  const blk = useCertBlock(eid);
  if (blk === undefined) return <div className="stack"><Back eid={eid} t={t} /><div className="skeleton card" /></div>;
  if (!blk) return <div className="stack"><Back eid={eid} t={t} /><p className="body">{t("b4.unavailable")}</p></div>;
  const { projectBrief, sections, journal, rubric, evaluation } = blk.payload;
  const days = journal.entries.map((e) => e.day);
  const minWords = journal.entries[0]?.minWords ?? 50;
  return (
    <div className="stack">
      <Back eid={eid} t={t} />
      <div><div className="eyebrow">{t("pj.eyebrow")}</div><h1 style={{ marginTop: 6 }}>{t("b4.title")}</h1></div>
      <p className="body" style={{ margin: 0 }}>{t("b4.intro")}</p>

      <div className="hf-card hf-card--stripe-orange stack">
        <div className="hf-pam"><span className="tag">{t("mission")}</span><div className="quote" style={{ whiteSpace: "pre-wrap" }}>{projectBrief}</div></div>
      </div>

      <div className="eyebrow">{t("b4.sections")}</div>
      {sections.map((s, i) => (
        <div key={i} className="hf-card stack" style={{ gap: 6 }}>
          <div className="row between" style={{ gap: 8 }}>
            <strong className="h4">{i + 1}. {s.title}</strong>
            {s.durationEstimate && <span className="hf-pill hf-pill--soft hf-pill--sm" style={{ whiteSpace: "nowrap" }}>{s.durationEstimate}</span>}
          </div>
          {s.helpText && <p className="meta" style={{ margin: 0 }}>{s.helpText}</p>}
          {i === 3 && (
            <p className="meta" style={{ margin: 0 }}>
              📓 {t("b4.journalCadence", { from: days[0] ?? 2, to: days[days.length - 1] ?? 15, n: journal.entries.length, min: minWords })}
            </p>
          )}
        </div>
      ))}

      {/* La règle d'assemblage de la Section 5 — EN GRAS (consigne 06/10/2026). */}
      <div className="hf-card hf-card--icy">
        <p className="body" style={{ margin: 0 }}><strong>{t("pj.sectionLocked")}</strong></p>
      </div>

      <div className="hf-card stack" style={{ gap: 6 }}>
        <strong className="h4">{t("b4.evalTitle")}</strong>
        <p className="meta" style={{ margin: 0 }}>{t("b4.evaluation", { days: evaluation?.turnaroundDays ?? 5, threshold: rubric.threshold })}</p>
      </div>

      <button className="hf-btn hf-btn--primary hf-btn--block" onClick={() => navigate(routes.grille(eid))}>{t("b4.seeRubric")}</button>
    </div>
  );
}

/** « Grille d'évaluation du projet » — la même carte que l'écran Projet
 *  (critères dépliants, bandes, minima, décision), consultable à tout moment. */
export function GrillePage({ eid }: { eid: string }) {
  const t = useT();
  const blk = useCertBlock(eid);
  if (blk === undefined) return <div className="stack"><Back eid={eid} t={t} /><div className="skeleton card" /></div>;
  if (!blk) return <div className="stack"><Back eid={eid} t={t} /><p className="body">{t("b4.unavailable")}</p></div>;
  return (
    <div className="stack">
      <Back eid={eid} t={t} />
      <div><div className="eyebrow">{t("pj.eyebrow")}</div><h1 style={{ marginTop: 6 }}>{t("gr.title")}</h1></div>
      <p className="body" style={{ margin: 0 }}>{t("gr.intro")}</p>
      <RubricCard rubric={blk.payload.rubric} />
    </div>
  );
}
