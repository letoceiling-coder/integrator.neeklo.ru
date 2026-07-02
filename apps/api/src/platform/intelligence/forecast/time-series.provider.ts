import type { ForecastProvider, ForecastRequest, ForecastResult, ForecastPoint } from './forecast.provider';

/**
 * Time-series forecast using linear regression on historical warehouse data.
 * No hardcoded multipliers — slope/intercept derived entirely from history.
 * Replace with ML provider by implementing {@link ForecastProvider} and rebinding DI.
 */
export class TimeSeriesForecastProvider implements ForecastProvider {
  readonly name = 'time_series_regression_v1';

  async predict(request: ForecastRequest): Promise<ForecastResult> {
    const forecasts: ForecastPoint[] = [];

    for (const { metric, history } of request.series) {
      if (history.length < 2) {
        const last = history[history.length - 1]?.value ?? 0;
        forecasts.push({
          metric,
          current: last,
          forecast: last,
          confidence: 0.3,
          trend: 'stable',
          seasonalityFactor: 1,
        });
        continue;
      }

      const { slope, intercept, r2 } = linearRegression(history.map((h, i) => ({ x: i, y: h.value })));
      const current = history[history.length - 1]!.value;
      const nextX = history.length + request.horizonDays - 1;
      const rawForecast = intercept + slope * nextX;
      const forecast = Math.max(0, rawForecast);

      const trend = slope > 0.01 ? 'rising' : slope < -0.01 ? 'falling' : 'stable';
      const seasonalityFactor = computeSeasonality(history.map((h) => h.value));

      forecasts.push({
        metric,
        current,
        forecast,
        confidence: Math.min(0.95, Math.max(0.2, r2)),
        trend,
        seasonalityFactor,
      });
    }

    return {
      algorithm: this.name,
      horizonDays: request.horizonDays,
      forecasts,
      generatedAt: new Date().toISOString(),
    };
  }
}

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

/** Detect weekly seasonality from autocorrelation at lag 7 (if enough points). */
function computeSeasonality(values: number[]): number {
  if (values.length < 14) return 1;
  const lag = 7;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 1;
  let num = 0;
  let den = 0;
  for (let i = lag; i < values.length; i++) {
    num += (values[i]! - mean) * (values[i - lag]! - mean);
    den += (values[i]! - mean) ** 2;
  }
  const ac = den > 0 ? num / den : 0;
  return 1 + ac * 0.1;
}
