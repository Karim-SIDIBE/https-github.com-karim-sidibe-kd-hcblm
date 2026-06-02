/**
 * forecast.ts — completion-rate forecasting (§7.3, line 220).
 *
 * Estimates the share of enrolled learners expected to reach Block 4 (final
 * certification) completion, from current progression rates. Pure + deterministic
 * so it is unit-testable and warehouse-portable.
 *
 * Model (interpretable, per learner):
 *   - already certified          → p = 1
 *   - dropped / expired          → p = 0
 *   - in progress                → extrapolate the observed block velocity over a
 *                                  projection horizon: projected = done + rate·H,
 *                                  p = clamp(projected / total, 0..1)
 * The forecast is the mean of p across the eligible population.
 */
export type ForecastRow = {
  blocksCompleted: number;
  blocksTotal: number;
  daysSinceStart: number;
  certified: boolean;
  terminated: boolean; // dropped / expired — will not complete
};

export type Forecast = {
  enrollments: number;
  certified: number;
  /** Estimated % of all enrolments expected to reach Block 4 completion. */
  forecastPercent: number;
  /** Current realised completion %, for comparison. */
  currentPercent: number;
  horizonDays: number;
};

export function forecastCompletion(rows: ForecastRow[], horizonDays = 90): Forecast {
  const n = rows.length;
  if (n === 0) return { enrollments: 0, certified: 0, forecastPercent: 0, currentPercent: 0, horizonDays };

  let certified = 0;
  let pSum = 0;
  for (const r of rows) {
    if (r.certified) { certified++; pSum += 1; continue; }
    if (r.terminated) continue; // p = 0
    const total = Math.max(1, r.blocksTotal);
    const days = Math.max(1, r.daysSinceStart);
    const rate = r.blocksCompleted / days; // blocks per day
    const projected = r.blocksCompleted + rate * horizonDays;
    pSum += Math.max(0, Math.min(1, projected / total));
  }

  return {
    enrollments: n,
    certified,
    forecastPercent: Math.round((pSum / n) * 100),
    currentPercent: Math.round((certified / n) * 100),
    horizonDays,
  };
}
