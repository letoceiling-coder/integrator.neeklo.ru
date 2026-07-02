import { z } from 'zod';
import { marketplaceCodeSchema } from '../marketplace';

/** Avito Enterprise Platform events — stream `avito`. */
export const AvitoEventType = {
  AccountLinked: 'avito.account_linked',
  AccountSyncStarted: 'avito.account_sync_started',
  AccountSyncCompleted: 'avito.account_sync_completed',
  AccountSyncFailed: 'avito.account_sync_failed',
  StatsPulled: 'avito.stats_pulled',
  ListingPipelineStarted: 'avito.listing_pipeline_started',
  ListingPipelineStepCompleted: 'avito.listing_pipeline_step_completed',
  ListingPipelineCompleted: 'avito.listing_pipeline_completed',
  RegionalDraftCreated: 'avito.regional_draft_created',
  RegionalPublishPlanned: 'avito.regional_publish_planned',
  KnowledgeDocumentUploaded: 'avito.knowledge_document_uploaded',
  KnowledgeChunkIndexed: 'avito.knowledge_chunk_indexed',
  MediaAssetStored: 'avito.media_asset_stored',
  NotificationDispatched: 'avito.notification_dispatched',
  AutomationExecuted: 'avito.automation_executed',
  BudgetImported: 'avito.budget_imported',
  WebhookReceived: 'avito.webhook_received',
} as const;
export type AvitoEventType = (typeof AvitoEventType)[keyof typeof AvitoEventType];

export const ListingPipelineStep = {
  RESEARCH: 'research',
  TITLE: 'title',
  DESCRIPTION: 'description',
  SEO: 'seo',
  PSYCHOLOGY: 'psychology',
  REGIONAL: 'regional',
  QUALITY: 'quality',
  FINAL: 'final',
} as const;
export type ListingPipelineStep = (typeof ListingPipelineStep)[keyof typeof ListingPipelineStep];
export const listingPipelineStepSchema = z.enum([
  ListingPipelineStep.RESEARCH,
  ListingPipelineStep.TITLE,
  ListingPipelineStep.DESCRIPTION,
  ListingPipelineStep.SEO,
  ListingPipelineStep.PSYCHOLOGY,
  ListingPipelineStep.REGIONAL,
  ListingPipelineStep.QUALITY,
  ListingPipelineStep.FINAL,
]);

export const avitoEventCatalog = {
  [AvitoEventType.AccountLinked]: z.object({
    accountId: z.string(),
    externalAccountId: z.string(),
    displayName: z.string(),
    linkedAt: z.string().datetime(),
  }),
  [AvitoEventType.AccountSyncStarted]: z.object({
    accountId: z.string(),
    syncJobId: z.string(),
    startedAt: z.string().datetime(),
  }),
  [AvitoEventType.AccountSyncCompleted]: z.object({
    accountId: z.string(),
    syncJobId: z.string(),
    itemsSynced: z.number().int().nonnegative(),
    completedAt: z.string().datetime(),
  }),
  [AvitoEventType.AccountSyncFailed]: z.object({
    accountId: z.string(),
    syncJobId: z.string(),
    error: z.string(),
    failedAt: z.string().datetime(),
  }),
  [AvitoEventType.StatsPulled]: z.object({
    accountId: z.string(),
    adIds: z.array(z.string()),
    pulledAt: z.string().datetime(),
  }),
  [AvitoEventType.ListingPipelineStarted]: z.object({
    pipelineId: z.string(),
    productInput: z.string(),
    startedAt: z.string().datetime(),
  }),
  [AvitoEventType.ListingPipelineStepCompleted]: z.object({
    pipelineId: z.string(),
    step: listingPipelineStepSchema,
    outputPreview: z.string(),
    completedAt: z.string().datetime(),
  }),
  [AvitoEventType.ListingPipelineCompleted]: z.object({
    pipelineId: z.string(),
    adId: z.string().nullable(),
    qualityScore: z.number().min(0).max(100),
    completedAt: z.string().datetime(),
  }),
  [AvitoEventType.RegionalDraftCreated]: z.object({
    batchId: z.string(),
    sourceAdId: z.string().nullable(),
    regionId: z.string(),
    cityId: z.string(),
    draftAdId: z.string(),
    localizedTitle: z.string(),
    publishMode: z.enum(['draft', 'manual_export']),
  }),
  [AvitoEventType.RegionalPublishPlanned]: z.object({
    batchId: z.string(),
    regionCount: z.number().int().positive(),
    note: z.string(),
  }),
  [AvitoEventType.KnowledgeDocumentUploaded]: z.object({
    documentId: z.string(),
    name: z.string(),
    category: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    storageKey: z.string(),
  }),
  [AvitoEventType.KnowledgeChunkIndexed]: z.object({
    documentId: z.string(),
    chunkCount: z.number().int().nonnegative(),
    indexedAt: z.string().datetime(),
  }),
  [AvitoEventType.MediaAssetStored]: z.object({
    assetId: z.string(),
    kind: z.string(),
    storageKey: z.string(),
    publicUrl: z.string(),
    entityType: z.string().nullable(),
    entityId: z.string().nullable(),
  }),
  [AvitoEventType.NotificationDispatched]: z.object({
    channel: z.enum(['telegram', 'max', 'email', 'web_push', 'in_app']),
    notificationId: z.string(),
    category: z.string(),
    success: z.boolean(),
    dispatchedAt: z.string().datetime(),
  }),
  [AvitoEventType.AutomationExecuted]: z.object({
    automationId: z.string(),
    trigger: z.string(),
    success: z.boolean(),
    executedAt: z.string().datetime(),
  }),
  [AvitoEventType.BudgetImported]: z.object({
    source: z.enum(['manual', 'csv', 'api']),
    amount: z.number(),
    category: z.string(),
    note: z.string().nullable(),
    importedAt: z.string().datetime(),
  }),
  [AvitoEventType.WebhookReceived]: z.object({
    marketplace: marketplaceCodeSchema,
    eventType: z.string(),
    receivedAt: z.string().datetime(),
  }),
} as const satisfies Record<AvitoEventType, z.ZodTypeAny>;
