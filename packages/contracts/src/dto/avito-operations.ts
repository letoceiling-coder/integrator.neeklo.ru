import { z } from 'zod';
import { adStatusSchema } from '../marketplace';
import { moneySchema } from './common';

export const AvitoAdViewMode = {
  Table: 'table',
  Cards: 'cards',
  Gallery: 'gallery',
  Compact: 'compact',
  Kanban: 'kanban',
  Timeline: 'timeline',
} as const;
export type AvitoAdViewMode = (typeof AvitoAdViewMode)[keyof typeof AvitoAdViewMode];
export const avitoAdViewModeSchema = z.enum(['table', 'cards', 'gallery', 'compact', 'kanban', 'timeline']);

export const avitoAdsFilterSchema = z.object({
  accountId: z.string().uuid().optional(),
  q: z.string().optional(),
  status: adStatusSchema.optional(),
  categoryId: z.string().optional(),
  regionId: z.string().optional(),
  cityId: z.string().optional(),
  priceMin: z.coerce.number().int().optional(),
  priceMax: z.coerce.number().int().optional(),
  promotion: z.enum(['active', 'none', 'any']).optional(),
  autoload: z.enum(['synced', 'pending', 'error', 'any']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  ctrMin: z.coerce.number().min(0).max(1).optional(),
  contactsMin: z.coerce.number().int().optional(),
  aiScoreMin: z.coerce.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  groupId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type AvitoAdsFilterDto = z.infer<typeof avitoAdsFilterSchema>;

export interface AvitoEnrichedAdDto {
  id: string;
  externalId: string | null;
  title: string;
  categoryId: string;
  subcategoryId: string | null;
  regionId: string;
  cityId: string;
  price: { amount: number; currency: string };
  status: string;
  imageUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  metrics: {
    views: number;
    contacts: number;
    favorites: number;
    ctr: number;
    messages: number;
  };
  aiScore: number | null;
  aiRecommendation: string | null;
  promotionStatus: string;
  feedStatus: string;
  syncStatus: string;
  webhookStatus: string;
  health: 'healthy' | 'degraded' | 'error';
  errors: string[];
  version: number;
  tags: string[];
}

export interface AvitoAdsPageDto {
  items: AvitoEnrichedAdDto[];
  total: number;
  nextCursor: string | null;
  limitations: string[];
}

export const avitoBulkOperationSchema = z.object({
  accountId: z.string().uuid().optional(),
  adIds: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum([
    'price_change',
    'description_change',
    'region_change',
    'category_change',
    'add_tags',
    'archive',
    'copy',
    'group',
    'prepare_feed',
    'export',
    'validate',
    'ai_rewrite',
    'ai_optimize',
    'sync_price_avito',
  ]),
  priceDelta: z.number().optional(),
  price: moneySchema.optional(),
  description: z.string().max(10000).optional(),
  regionId: z.string().optional(),
  cityId: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  groupId: z.string().uuid().optional(),
});
export type AvitoBulkOperationDto = z.infer<typeof avitoBulkOperationSchema>;

export const avitoAdStudioUpdateSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().max(10000).optional(),
  price: moneySchema.optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().nullable().optional(),
  regionId: z.string().optional(),
  cityId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  params: z.record(z.unknown()).optional(),
});
export type AvitoAdStudioUpdateDto = z.infer<typeof avitoAdStudioUpdateSchema>;

export interface AvitoAdStudioDto {
  ad: AvitoEnrichedAdDto;
  mediaAssets: { id: string; kind: string; publicUrl: string; mimeType: string }[];
  validation: { ok: boolean; errors: string[]; warnings: string[] };
  aiSuggestions: string[];
  seo: { score: number; keywords: string[]; recommendations: string[] };
  history: { at: string; changeType: string; snapshot: unknown }[];
  versions: { version: number; updatedAt: string }[];
  analytics: { views: number; contacts: number; ctr: number; forecast: string | null };
  limitations: string[];
}

export const avitoFeedExportSchema = z.object({
  accountId: z.string().uuid(),
  format: z.enum(['xml', 'csv', 'json']),
  adIds: z.array(z.string().uuid()).optional(),
  templateId: z.string().uuid().optional(),
});
export type AvitoFeedExportDto = z.infer<typeof avitoFeedExportSchema>;

export interface AvitoFeedStudioDto {
  autoloadProfile: unknown;
  uploads: unknown[];
  templates: { id: string; name: string; format: string; updatedAt: string }[];
  history: { id: string; format: string; adCount: number; status: string; createdAt: string; version: number }[];
  queue: { pending: number; processing: number; failed: number };
  limitations: string[];
}

export interface AvitoPromotionCenterDto {
  services: unknown[];
  activePromotions: unknown[];
  history: { at: string; itemId: string; service: string; cost: number | null }[];
  recommendations: { adId: string; title: string; suggestion: string; estimatedRoi: number | null }[];
  limitations: string[];
}

export interface AvitoOperationsTimelineEntryDto {
  id: string;
  at: string;
  kind: 'create' | 'update' | 'sync' | 'webhook' | 'promotion' | 'ai' | 'error' | 'feed' | 'media' | 'system';
  adId: string | null;
  title: string;
  detail: string | null;
  correlationId: string | null;
}

export interface AvitoQualityReportDto {
  adId: string;
  qualityScore: number;
  errors: string[];
  missingFields: string[];
  photoIssues: string[];
  descriptionIssues: string[];
  keywordGaps: string[];
  recommendations: string[];
}

export interface AvitoOperationsHealthDto {
  adsCount: number;
  syncedCount: number;
  feedReadyCount: number;
  promotionAvailable: boolean;
  autoloadAvailable: boolean;
  directPublishAvailable: boolean;
  limitations: string[];
}

export const avitoMediaProJobSchema = z.object({
  kind: z.enum([
    'remove_background',
    'enhance',
    'banner',
    'infographic',
    'watermark',
    'resize',
    'compress',
    'generate_image',
  ]),
  input: z.record(z.unknown()).default({}),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  batch: z.array(z.record(z.unknown())).optional(),
});
export type AvitoMediaProJobDto = z.infer<typeof avitoMediaProJobSchema>;
