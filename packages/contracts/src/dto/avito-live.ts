import { z } from 'zod';

/** Official Avito Live sync worker identifiers. */
export const AvitoSyncWorker = {
  Profile: 'profile',
  Items: 'items',
  Categories: 'categories',
  Tariff: 'tariff',
  ApiCatalog: 'api_catalog',
  Messenger: 'messenger',
  Stats: 'stats',
  Promotion: 'promotion',
  Autoload: 'autoload',
  Hierarchy: 'hierarchy',
  Phones: 'phones',
  Employees: 'employees',
  Ratings: 'ratings',
  Reviews: 'reviews',
  Stock: 'stock',
  CallTracking: 'call_tracking',
  Delivery: 'delivery',
  Jobs: 'jobs',
} as const;
export type AvitoSyncWorker = (typeof AvitoSyncWorker)[keyof typeof AvitoSyncWorker];

export const avitoSyncIntervalSchema = z.enum([
  '30s',
  '1m',
  '5m',
  '15m',
  '1h',
  '1d',
]);

export type AvitoSyncInterval = z.infer<typeof avitoSyncIntervalSchema>;

export const AVITO_SYNC_INTERVAL_SEC: Record<AvitoSyncInterval, number> = {
  '30s': 30,
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86400,
};

export const avitoSyncScheduleUpdateSchema = z.object({
  accountId: z.string().uuid(),
  worker: z.string(),
  interval: avitoSyncIntervalSchema,
  enabled: z.boolean().optional(),
});

export type AvitoSyncScheduleUpdateDto = z.infer<typeof avitoSyncScheduleUpdateSchema>;

export type AvitoSyncWorkerStatus = 'pending' | 'running' | 'completed' | 'failed' | 'unavailable' | 'limited';

export interface AvitoSyncWorkerStateDto {
  worker: string;
  label: string;
  officialApi: string;
  intervalSec: number;
  enabled: boolean;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  status: AvitoSyncWorkerStatus;
  latencyMs: number | null;
  lastError: string | null;
  retryCount: number;
  sourceCount: number;
  updatedCount: number;
  deletedCount: number;
  version: number;
  limitation: string | null;
}

export interface AvitoSyncDashboardDto {
  accountId: string;
  workers: AvitoSyncWorkerStateDto[];
  queueDepth: number;
  activeWorker: string | null;
  lastFullSyncAt: string | null;
  apiRequestsLastHour: number;
  rateLimitRemaining: number | null;
}

export interface AvitoAccountOverviewDto {
  accountId: string;
  displayName: string;
  externalAccountId: string | null;
  accountType: string | null;
  companyName: string | null;
  tariff: unknown;
  balanceRub: number | null;
  phone: string | null;
  email: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  apiHealth: string;
  webhookStatus: string;
  promotionAvailable: boolean;
  messengerAvailable: boolean;
  autoloadAvailable: boolean;
  limitations: string[];
}

export interface AvitoExplorerNodeDto {
  id: string;
  label: string;
  type: string;
  count: number | null;
  status: AvitoSyncWorkerStatus;
  children?: AvitoExplorerNodeDto[];
}

export interface AvitoApiUsageDto {
  requestsLastHour: number;
  requestsLastDay: number;
  rateLimitRemaining: number | null;
  rateLimitReset: string | null;
  errors429: number;
  avgLatencyMs: number;
  heaviestRequests: { url: string; method: string; count: number; avgLatencyMs: number }[];
  recentErrors: { at: string; status: number; url: string; message: string }[];
}

export interface AvitoWebhookCenterDto {
  webhookUrl: string;
  status: string;
  subscriptionId: string | null;
  lastReceivedAt: string | null;
  lastError: string | null;
  history: { at: string; eventType: string; ok: boolean }[];
}

export interface AvitoTimelineEntryDto {
  id: string;
  at: string;
  kind: 'oauth' | 'sync' | 'ads' | 'messages' | 'promotion' | 'webhook' | 'error' | 'ai';
  title: string;
  detail: string | null;
  correlationId: string | null;
}

export interface AvitoSyncInspectorEntryDto {
  worker: string;
  entityType: string;
  source: string;
  received: number;
  updated: number;
  deleted: number;
  version: number;
  updatedAt: string | null;
  retryCount: number;
  status: AvitoSyncWorkerStatus;
}

export interface AvitoLiveHealthDto {
  oauth: { status: string; message: string };
  vault: { status: string; message: string };
  avitoApi: { status: string; latencyMs: number; message: string };
  webhook: { status: string; message: string };
  sync: { status: string; workersOk: number; workersTotal: number };
  queues: { status: string; depth: number };
  workers: { status: string; active: number };
  readModels: { status: string; snapshots: number };
  storage: { status: string; message: string };
  ai: { status: string; message: string };
}
