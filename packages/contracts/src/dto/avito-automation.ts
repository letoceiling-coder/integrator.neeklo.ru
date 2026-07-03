import { z } from 'zod';

export const AvitoWatcherMetric = {
  Ctr: 'ctr',
  Views: 'views',
  Contacts: 'contacts',
  Favorites: 'favorites',
  Roi: 'roi',
  Roas: 'roas',
  Cpa: 'cpa',
  PromotionCost: 'promotion_cost',
  Budget: 'budget',
  Region: 'region',
  Sales: 'sales',
  Conversion: 'conversion',
  Messages: 'messages',
} as const;
export type AvitoWatcherMetric = (typeof AvitoWatcherMetric)[keyof typeof AvitoWatcherMetric];

export const avitoWatcherMetricSchema = z.enum([
  'ctr',
  'views',
  'contacts',
  'favorites',
  'roi',
  'roas',
  'cpa',
  'promotion_cost',
  'budget',
  'region',
  'sales',
  'conversion',
  'messages',
]);

export interface AvitoAiWatcherDto {
  id: string;
  name: string;
  metric: AvitoWatcherMetric;
  entityType: string;
  entityId: string | null;
  enabled: boolean;
  compareDays: number;
  anomalyThresholdPct: number;
  lastRunAt: string | null;
  lastStatus: 'ok' | 'anomaly' | 'growth' | 'decline' | 'error' | null;
  lastValue: number | null;
  lastForecast: string | null;
  recommendation: string | null;
}

export const avitoAiWatcherCreateSchema = z.object({
  name: z.string().min(1),
  metric: avitoWatcherMetricSchema,
  entityType: z.string().default('organization'),
  entityId: z.string().uuid().nullable().optional(),
  compareDays: z.number().int().min(1).max(90).default(7),
  anomalyThresholdPct: z.number().min(5).max(100).default(30),
  enabled: z.boolean().default(true),
});
export type AvitoAiWatcherCreateDto = z.infer<typeof avitoAiWatcherCreateSchema>;

export const AvitoRuleOperator = {
  DropPct: 'drop_pct',
  RisePct: 'rise_pct',
  Below: 'below',
  Above: 'above',
  NoMessagesDays: 'no_messages_days',
  BudgetDaysLeft: 'budget_days_left',
  AiConfidence: 'ai_confidence',
} as const;
export type AvitoRuleOperator = (typeof AvitoRuleOperator)[keyof typeof AvitoRuleOperator];

export const AvitoRuleActionType = {
  Recommendation: 'recommendation',
  Notify: 'notify',
  Task: 'task',
} as const;

export interface AvitoAutomationRuleDto {
  id: string;
  name: string;
  enabled: boolean;
  metric: AvitoWatcherMetric | 'messages' | 'budget';
  operator: AvitoRuleOperator;
  threshold: number;
  actionType: (typeof AvitoRuleActionType)[keyof typeof AvitoRuleActionType];
  actionPayload: Record<string, unknown>;
  requiresConfirmation: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
}

export const avitoAutomationRuleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  metric: avitoWatcherMetricSchema.or(z.enum(['messages', 'budget'])),
  operator: z.enum(['drop_pct', 'rise_pct', 'below', 'above', 'no_messages_days', 'budget_days_left', 'ai_confidence']),
  threshold: z.number(),
  actionType: z.enum(['recommendation', 'notify', 'task']),
  actionPayload: z.record(z.unknown()).default({}),
  requiresConfirmation: z.boolean().default(true),
});
export type AvitoAutomationRuleUpsertDto = z.infer<typeof avitoAutomationRuleSchema>;

export const AvitoObservatoryKind = {
  Recommendation: 'recommendation',
  Warning: 'warning',
  Forecast: 'forecast',
  Anomaly: 'anomaly',
  Opportunity: 'opportunity',
} as const;

export interface AvitoObservatoryItemDto {
  id: string;
  kind: (typeof AvitoObservatoryKind)[keyof typeof AvitoObservatoryKind];
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  source: string;
  createdAt: string;
  dismissed: boolean;
}

export interface AvitoObservatoryDto {
  items: AvitoObservatoryItemDto[];
  counts: { recommendations: number; warnings: number; forecasts: number; anomalies: number; opportunities: number };
}

export interface AvitoOpportunityItemDto {
  id: string;
  kind: string;
  entityType: string;
  entityId: string;
  score: number;
  reason: string;
  detectedAt: string;
}

export interface AvitoPriceRecommendationDto {
  id: string;
  adId: string;
  adTitle: string;
  currentPrice: number;
  suggestedPrice: number;
  direction: 'up' | 'down' | 'hold';
  confidence: number;
  reason: string;
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: string;
}

export interface AvitoContentRecommendationDto {
  id: string;
  adId: string;
  adTitle: string;
  field: 'photo' | 'title' | 'description' | 'seo' | 'keywords' | 'quality';
  suggestion: string;
  score: number;
  status: 'pending' | 'applied' | 'dismissed';
  createdAt: string;
}

export const AvitoNotificationPolicyFilter = {
  Critical: 'critical',
  Ai: 'ai',
  Sales: 'sales',
  All: 'all',
} as const;

export interface AvitoNotificationPolicyDto {
  id: string;
  name: string;
  enabled: boolean;
  channels: ('telegram' | 'max' | 'email' | 'web_push' | 'in_app')[];
  filters: (typeof AvitoNotificationPolicyFilter)[keyof typeof AvitoNotificationPolicyFilter][];
}

export const avitoNotificationPolicySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  channels: z.array(z.enum(['telegram', 'max', 'email', 'web_push', 'in_app'])).min(1),
  filters: z.array(z.enum(['critical', 'ai', 'sales', 'all'])).min(1),
});
export type AvitoNotificationPolicyUpsertDto = z.infer<typeof avitoNotificationPolicySchema>;

export interface AvitoAiReportDto {
  id: string;
  generatedAt: string;
  summary: string;
  changes: string[];
  improvements: string[];
  todayActions: string[];
  fullText: string;
}

export interface AvitoExecutiveAiDto {
  generatedAt: string;
  summary: string;
  highlights: string[];
  risks: string[];
  opportunities: string[];
  plainLanguage: string;
}
