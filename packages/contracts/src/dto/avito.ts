import { z } from 'zod';
import { marketplaceCodeSchema } from '../marketplace';
import { listingPipelineStepSchema } from '../events/avito-catalog';
import { MediaJobKind } from '../events/commerce-catalog';

export const avitoAccountStatusSchema = z.enum(['pending', 'authorized', 'error', 'limited']);
export type AvitoAccountStatus = z.infer<typeof avitoAccountStatusSchema>;

export const avitoAccountReadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  marketplace: marketplaceCodeSchema,
  displayName: z.string(),
  externalAccountId: z.string().nullable(),
  status: avitoAccountStatusSchema,
  lastSyncAt: z.string().datetime().nullable(),
  lastSyncStatus: z.string().nullable(),
  lastSyncError: z.string().nullable(),
  balanceRub: z.number().nullable(),
  dailyMessageLimit: z.number().int().nullable(),
  permissions: z.array(z.string()),
  enabled: z.boolean(),
});
export type AvitoAccountReadModel = z.infer<typeof avitoAccountReadSchema>;

export const bulkAdActionSchema = z.object({
  adIds: z.array(z.string()).min(1).max(500),
  action: z.enum(['archive', 'price_change', 'copy', 'group']),
  priceDelta: z.number().optional(),
  groupId: z.string().optional(),
});
export type BulkAdActionDto = z.infer<typeof bulkAdActionSchema>;

export const adTemplateSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string(),
  titleTemplate: z.string(),
  descriptionTemplate: z.string(),
  defaultPrice: z.number().int().positive().optional(),
});
export type AdTemplateDto = z.infer<typeof adTemplateSchema>;

export const listingGeneratorInputSchema = z.object({
  product: z.string().min(1).max(10000),
  categoryId: z.string().optional(),
  regionId: z.string().optional(),
  competitorHints: z.string().optional(),
  createDraft: z.boolean().default(true),
});
export type ListingGeneratorInputDto = z.infer<typeof listingGeneratorInputSchema>;

export const listingPipelineReadSchema = z.object({
  id: z.string(),
  status: z.enum(['running', 'completed', 'failed']),
  productInput: z.string(),
  steps: z.array(
    z.object({
      step: listingPipelineStepSchema,
      output: z.string(),
      completedAt: z.string().datetime(),
    }),
  ),
  finalTitle: z.string().nullable(),
  finalDescription: z.string().nullable(),
  qualityScore: z.number().nullable(),
  adId: z.string().nullable(),
});
export type ListingPipelineReadModel = z.infer<typeof listingPipelineReadSchema>;

export const regionalPublishInputSchema = z.object({
  sourceAdId: z.string().optional(),
  product: z.string().optional(),
  basePrice: z.number().int().positive(),
  regions: z.array(z.object({ regionId: z.string(), cityId: z.string() })).min(1).max(50),
});
export type RegionalPublishInputDto = z.infer<typeof regionalPublishInputSchema>;

export const knowledgeUploadSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['price_list', 'contract', 'faq', 'policy', 'catalog', 'examples']).default('faq'),
  content: z.string().min(1).max(500_000),
  mimeType: z.string().default('text/plain'),
});
export type KnowledgeUploadDto = z.infer<typeof knowledgeUploadSchema>;

export const knowledgeDocumentReadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  category: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  chunkCount: z.number().int(),
  indexed: z.boolean(),
  createdAt: z.string().datetime(),
});
export type KnowledgeDocumentReadModel = z.infer<typeof knowledgeDocumentReadSchema>;

export const mediaPipelineJobSchema = z.object({
  kind: z.nativeEnum(MediaJobKind),
  input: z.record(z.unknown()).default({}),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});
export type MediaPipelineJobDto = z.infer<typeof mediaPipelineJobSchema>;

export const avitoAnalyticsSummarySchema = z.object({
  views: z.number().int(),
  contacts: z.number().int(),
  favorites: z.number().int(),
  messages: z.number().int(),
  ctr: z.number(),
  conversionRate: z.number(),
  spend: z.number(),
  revenue: z.number(),
  roi: z.number(),
  roas: z.number(),
  cpa: z.number(),
  aiScore: z.number().nullable(),
  forecastTrend: z.enum(['up', 'down', 'stable']).nullable(),
  recommendationCount: z.number().int(),
  dataSource: z.enum(['projection', 'avito_api', 'manual', 'mixed']),
});
export type AvitoAnalyticsSummaryDto = z.infer<typeof avitoAnalyticsSummarySchema>;

export const budgetImportSchema = z.object({
  amount: z.number().positive(),
  category: z.enum(['promotion', 'placement', 'commission', 'other']),
  adId: z.string().optional(),
  regionId: z.string().optional(),
  note: z.string().optional(),
  source: z.enum(['manual', 'csv']).default('manual'),
});
export type BudgetImportDto = z.infer<typeof budgetImportSchema>;

export const notificationChannelConfigSchema = z.object({
  telegramChatId: z.string().optional(),
  maxUserId: z.string().optional(),
  email: z.string().email().optional(),
  webPushEnabled: z.boolean().default(false),
});
export type NotificationChannelConfigDto = z.infer<typeof notificationChannelConfigSchema>;

export const assignConversationSchema = z.object({
  assigneeId: z.string(),
});
export type AssignConversationDto = z.infer<typeof assignConversationSchema>;

export const agentReplyOptionsSchema = z.object({
  conversationId: z.string(),
  customerId: z.string(),
  adId: z.string().nullable().optional(),
  message: z.string(),
  autoSend: z.boolean().default(false),
  minConfidence: z.number().min(0).max(1).default(0.7),
});
export type AgentReplyOptionsDto = z.infer<typeof agentReplyOptionsSchema>;
