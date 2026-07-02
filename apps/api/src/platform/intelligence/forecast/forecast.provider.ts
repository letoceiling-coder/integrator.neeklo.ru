/** Pluggable forecast provider — swap implementation (time-series → ML) without API changes. */

export interface ForecastPoint {
  metric: string;
  current: number;
  forecast: number;
  confidence: number;
  trend: 'rising' | 'falling' | 'stable';
  seasonalityFactor: number;
}

export interface ForecastRequest {
  tenantId: string;
  entityType: string;
  entityId: string;
  horizonDays: number;
  series: { metric: string; history: { periodStart: string; value: number }[] }[];
}

export interface ForecastResult {
  algorithm: string;
  horizonDays: number;
  forecasts: ForecastPoint[];
  generatedAt: string;
}

export interface ForecastProvider {
  readonly name: string;
  predict(request: ForecastRequest): Promise<ForecastResult>;
}

export const FORECAST_PROVIDER = Symbol('FORECAST_PROVIDER');
