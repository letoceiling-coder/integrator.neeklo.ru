import { z } from 'zod';

/** Time bucket granularity for historical/metrics warehouses. */
export const Granularity = {
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
} as const;
export type Granularity = (typeof Granularity)[keyof typeof Granularity];
export const granularitySchema = z.enum([
  Granularity.HOUR,
  Granularity.DAY,
  Granularity.WEEK,
  Granularity.MONTH,
  Granularity.QUARTER,
  Granularity.YEAR,
]);

/** Business strategy profiles for Decision Engine weighting. */
export const StrategyType = {
  MAX_PROFIT: 'max_profit',
  MAX_SALES: 'max_sales',
  MIN_BUDGET: 'min_budget',
  MAX_ROI: 'max_roi',
  FAST_SALE: 'fast_sale',
  RETENTION: 'retention',
  REGION_EXPANSION: 'region_expansion',
} as const;
export type StrategyType = (typeof StrategyType)[keyof typeof StrategyType];
export const strategyTypeSchema = z.enum([
  StrategyType.MAX_PROFIT,
  StrategyType.MAX_SALES,
  StrategyType.MIN_BUDGET,
  StrategyType.MAX_ROI,
  StrategyType.FAST_SALE,
  StrategyType.RETENTION,
  StrategyType.REGION_EXPANSION,
]);

/** Decision actions emitted by Decision Engine. */
export const DecisionAction = {
  BOOST: 'boost',
  CHANGE_PRICE: 'change_price',
  ADD_PHOTOS: 'add_photos',
  REPLACE_COVER: 'replace_cover',
  REWRITE_DESCRIPTION: 'rewrite_description',
  STOP_PROMOTION: 'stop_promotion',
  INCREASE_BUDGET: 'increase_budget',
  REALLOCATE_BUDGET: 'reallocate_budget',
  ADD_REGION: 'add_region',
  REMOVE_REGION: 'remove_region',
} as const;
export type DecisionAction = (typeof DecisionAction)[keyof typeof DecisionAction];

/** Intelligence layer domain events — aggregate stream: `intelligence`. */
export const IntelligenceEventType = {
  ForecastGenerated: 'intelligence.forecast_generated',
  DecisionMade: 'intelligence.decision_made',
  DecisionApplied: 'intelligence.decision_applied',
  DecisionDismissed: 'intelligence.decision_dismissed',
  OpportunityDetected: 'intelligence.opportunity_detected',
  ExperimentStarted: 'intelligence.experiment_started',
  ExperimentCompleted: 'intelligence.experiment_completed',
  MemoryRecorded: 'intelligence.memory_recorded',
  RegionalRankingUpdated: 'intelligence.regional_ranking_updated',
  CompetitorChangeDetected: 'intelligence.competitor_change_detected',
  HistoricalRollupCompleted: 'intelligence.historical_rollup_completed',
  MetricsWarehouseUpdated: 'intelligence.metrics_warehouse_updated',
} as const;
export type IntelligenceEventType = (typeof IntelligenceEventType)[keyof typeof IntelligenceEventType];

const forecastPoint = z.object({
  metric: z.string(),
  current: z.number(),
  forecast: z.number(),
  confidence: z.number().min(0).max(1),
  trend: z.enum(['rising', 'falling', 'stable']),
});

export const intelligenceEventCatalog = {
  [IntelligenceEventType.ForecastGenerated]: z.object({
    entityType: z.string(),
    entityId: z.string(),
    horizonDays: z.number().int().positive(),
    algorithm: z.string(),
    forecasts: z.array(forecastPoint),
    generatedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.DecisionMade]: z.object({
    entityType: z.string(),
    entityId: z.string(),
    action: z.string(),
    strategy: strategyTypeSchema,
    confidence: z.number().min(0).max(1),
    reason: z.string(),
    payload: z.record(z.unknown()).default({}),
    generatedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.DecisionApplied]: z.object({
    decisionId: z.string(),
    appliedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.DecisionDismissed]: z.object({
    decisionId: z.string(),
    reason: z.string().nullable(),
    dismissedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.OpportunityDetected]: z.object({
    kind: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    score: z.number().min(0).max(100),
    reason: z.string(),
    payload: z.record(z.unknown()).default({}),
    detectedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.ExperimentStarted]: z.object({
    experimentId: z.string(),
    name: z.string(),
    variantCount: z.number().int().min(2),
    targetEntityType: z.string(),
    targetEntityId: z.string(),
    startedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.ExperimentCompleted]: z.object({
    experimentId: z.string(),
    winnerVariantId: z.string().nullable(),
    significance: z.number().min(0).max(1),
    completedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.MemoryRecorded]: z.object({
    memoryId: z.string(),
    subjectKind: z.string(),
    subjectId: z.string(),
    category: z.string(),
    content: z.string(),
    recordedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.RegionalRankingUpdated]: z.object({
    regionId: z.string(),
    rank: z.number().int().positive(),
    opportunityIndex: z.number(),
    updatedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.CompetitorChangeDetected]: z.object({
    adId: z.string(),
    competitorId: z.string(),
    changeType: z.enum(['price', 'photo', 'description', 'promotion', 'appeared', 'disappeared', 'rank']),
    details: z.record(z.unknown()).default({}),
    detectedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.HistoricalRollupCompleted]: z.object({
    entityType: z.string(),
    entityId: z.string(),
    fromGranularity: granularitySchema,
    toGranularity: granularitySchema,
    periodStart: z.string().datetime(),
    completedAt: z.string().datetime(),
  }),
  [IntelligenceEventType.MetricsWarehouseUpdated]: z.object({
    entityType: z.string(),
    entityId: z.string(),
    granularity: granularitySchema,
    periodStart: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
} as const;
