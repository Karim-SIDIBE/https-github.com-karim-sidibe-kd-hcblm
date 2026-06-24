/**
 * risk.ts — dropout-risk scoring (Learning Analytics, predictive layer).
 *
 * A TRANSPARENT weighted model over signals already collected (no black-box ML:
 * there is no labelled outcome data yet, and staff need an explainable reason per
 * learner — also RGPD-friendly). Each factor adds points with a human-readable
 * label; the score is capped at 100 and bucketed into a level. Tune the weights
 * here in one place. When enough real outcomes accumulate, this can be swapped
 * for a trained classifier behind the same interface.
 */

export type RiskFeatures = {
  certified: boolean;
  completed: boolean;
  daysSinceActivity: number; // since lastSeenAt (or enrolment if never seen)
  daysSinceStart: number;    // since startedAt
  progressPercent: number;   // 0–100
  pamCaptured: boolean;      // onboarding (Moment d'Ancrage) done
  diagnosticScore: number | null; // % (null = not taken)
  failedFinal: boolean;      // final quiz below the pass threshold
  nudgesSent: number;        // re-engagement messages already sent
};

export type RiskFactor = { label: string; points: number };
export type RiskLevel = "low" | "medium" | "high";
export type RiskResult = { score: number; level: RiskLevel; factors: RiskFactor[] };

const lvl = (score: number): RiskLevel => (score >= 60 ? "high" : score >= 30 ? "medium" : "low");

export function dropoutRisk(f: RiskFeatures): RiskResult {
  // A finished learner is never "at risk".
  if (f.certified || f.completed) return { score: 0, level: "low", factors: [] };

  const factors: RiskFactor[] = [];
  const d = Math.round(f.daysSinceActivity);

  // 1) Inactivity — the strongest early signal.
  if (f.daysSinceActivity >= 14) factors.push({ label: `Inactif depuis ${d} jours`, points: 40 });
  else if (f.daysSinceActivity >= 7) factors.push({ label: `Inactif depuis ${d} jours`, points: 25 });
  else if (f.daysSinceActivity >= 3) factors.push({ label: `Inactif depuis ${d} jours`, points: 12 });

  // 2) Stalled progress relative to time since enrolment.
  if (f.daysSinceStart >= 3 && f.progressPercent === 0) factors.push({ label: "N'a jamais commencé le contenu", points: 30 });
  else if (f.daysSinceStart >= 7 && f.progressPercent < 20) factors.push({ label: `Progression bloquée à ${f.progressPercent}%`, points: 22 });
  else if (f.daysSinceStart >= 14 && f.progressPercent < 50) factors.push({ label: `Progression lente (${f.progressPercent}% en ${Math.round(f.daysSinceStart)} j)`, points: 12 });

  // 3) Onboarding never completed.
  if (!f.pamCaptured && f.daysSinceStart >= 2) factors.push({ label: "Onboarding non terminé (Moment d'Ancrage absent)", points: 15 });

  // 4) Early difficulty — weak diagnostic.
  if (f.diagnosticScore != null && f.diagnosticScore < 50) factors.push({ label: `Score diagnostique faible (${f.diagnosticScore}%)`, points: 10 });

  // 5) Struggling at the certification gate.
  if (f.failedFinal) factors.push({ label: "Quiz final échoué (sous le seuil)", points: 15 });

  // 6) Re-engagement ignored — escalating disengagement.
  if (f.nudgesSent >= 2) factors.push({ label: `${f.nudgesSent} relances sans retour`, points: 15 });
  else if (f.nudgesSent >= 1) factors.push({ label: "1 relance sans retour", points: 8 });

  factors.sort((a, b) => b.points - a.points);
  const score = Math.min(100, factors.reduce((s, x) => s + x.points, 0));
  return { score, level: lvl(score), factors };
}
