import { useT } from "../lib/i18n";

/** Affichage apprenant (P7 + règle UX) : les codes du référentiel (S1, S2…,
 *  D1.C1…) en tête des libellés de critères sont retirés — la compétence
 *  elle-même suffit ; les codes restent un usage interne / SIRH. */
export const critLabel = (l: string) => l.replace(/^(?:S\d+|D\d+\.C\d+)\s*[—:-]\s*/, "");

export type RubricBand = { band: number; scoreRange: [number, number]; descriptor?: string };
export type RubricSpec = {
  criteria: { label: string; weightPoints: number; minPoints?: number; whereToLook?: string; bands?: RubricBand[] }[];
  threshold: number;
};

/** La grille d'évaluation telle que l'apprenant la voit — critères dépliants
 *  (bandes + « où l'évaluateur cherche la preuve »), seuil, cadre de décision
 *  et conseil de rédaction. Composant partagé (06/10/2026) : l'écran Projet du
 *  Bloc 4 ET la page « Grille d'évaluation du projet » accessible à tout
 *  moment depuis le menu — même rendu, zéro divergence. */
export function RubricCard({ rubric }: { rubric: RubricSpec }) {
  const t = useT();
  return (
    <div className="hf-card hf-card--icy stack">
      <strong className="h4">{t("pj.rubricTitle")} <span className="meta" style={{ fontWeight: 400 }}>{t("pj.rubricNote")}</span></strong>
      <div className="stack" style={{ gap: 8 }}>
        {rubric.criteria.map((c) => (
          <details key={c.label}>
            <summary className="row between" style={{ cursor: "pointer", listStyle: "none", gap: 8 }}>
              <span className="body">{critLabel(c.label)}</span>
              <span className="row" style={{ gap: 6 }}>
                {c.minPoints != null && <span className="hf-pill hf-pill--orange hf-pill--sm">{t("pj.rubricMin", { min: c.minPoints })}</span>}
                <span className="hf-pill hf-pill--soft hf-pill--sm">{t("pj.pts", { n: c.weightPoints })}</span>
              </span>
            </summary>
            <div className="stack" style={{ gap: 6, margin: "8px 0 4px 10px" }}>
              {(c.bands ?? []).slice().sort((a, b) => b.band - a.band).map((b) => (
                <p key={b.band} className="meta" style={{ margin: 0 }}>
                  <strong>{t("pj.band", { band: b.band, lo: b.scoreRange[0], hi: b.scoreRange[1] })}</strong>{b.descriptor ? ` — ${b.descriptor}` : ""}
                </p>
              ))}
              {c.whereToLook && <p className="meta" style={{ margin: 0, fontStyle: "italic" }}>{t("pj.whereToLook", { text: c.whereToLook })}</p>}
            </div>
          </details>
        ))}
      </div>
      <p className="meta" style={{ margin: 0 }}>{t("pj.passThreshold", { threshold: rubric.threshold })}</p>
      {/* Décision ternaire du socle §6, énoncée AVANT de soumettre — la
          non-compensation (minimum par critère) surprend sinon. */}
      <div className="stack" style={{ gap: 4 }}>
        <strong className="h4" style={{ fontSize: 14 }}>{t("pj.decisionTitle")}</strong>
        <p className="meta" style={{ margin: 0 }}>✅ {t("pj.decisionCertified", { threshold: rubric.threshold })}</p>
        <p className="meta" style={{ margin: 0 }}>🔁 {t("pj.decisionResubmit")}</p>
        <p className="meta" style={{ margin: 0 }}>⛔ {t("pj.decisionNotCertified")}</p>
      </div>
      <p className="meta" style={{ margin: 0 }}>{t("pj.writeTip")}</p>
    </div>
  );
}
