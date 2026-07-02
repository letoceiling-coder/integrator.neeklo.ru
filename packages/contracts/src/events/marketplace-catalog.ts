import { z } from 'zod';
import { marketplaceCodeSchema } from '../marketplace';

const money = z.object({ amount: z.number().int(), currency: z.string().default('RUB') });

/** Marketplace platform + plugin lifecycle events. */
export const MarketplaceEventType = {
  MarketplaceConnected: 'marketplace.connected',
  MarketplaceDisconnected: 'marketplace.disconnected',
  MarketplaceAuthorized: 'marketplace.authorized',
  MarketplaceSynchronizationStarted: 'marketplace.synchronization_started',
  MarketplaceSynchronizationCompleted: 'marketplace.synchronization_completed',
  MarketplaceSynchronizationFailed: 'marketplace.synchronization_failed',
  MarketplaceCapabilityChanged: 'marketplace.capability_changed',
  MarketplaceHealthChanged: 'marketplace.health_changed',
  MarketplaceRegionUpdated: 'marketplace.region_updated',
  MarketplaceCategoryUpdated: 'marketplace.category_updated',
  MarketplaceLimitsChanged: 'marketplace.limits_changed',
  MarketplaceStatisticsImported: 'marketplace.statistics_imported',
  MarketplaceWebhookReceived: 'marketplace.webhook_received',
  MarketplacePluginInstalled: 'marketplace.plugin_installed',
  MarketplacePluginRemoved: 'marketplace.plugin_removed',
  MarketplacePluginUpdated: 'marketplace.plugin_updated',
} as const;

export type MarketplaceEventType = (typeof MarketplaceEventType)[keyof typeof MarketplaceEventType];

export const marketplaceEventCatalog = {
  [MarketplaceEventType.MarketplaceConnected]: z.object({
    marketplace: marketplaceCodeSchema,
    pluginId: z.string(),
    connectedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceDisconnected]: z.object({
    marketplace: marketplaceCodeSchema,
    reason: z.string().nullable().default(null),
    disconnectedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceAuthorized]: z.object({
    marketplace: marketplaceCodeSchema,
    accountId: z.string(),
    externalAccountId: z.string(),
    authorizedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
  }),
  [MarketplaceEventType.MarketplaceSynchronizationStarted]: z.object({
    marketplace: marketplaceCodeSchema,
    accountId: z.string(),
    syncId: z.string(),
    mode: z.enum(['full', 'incremental', 'reconcile']),
    startedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceSynchronizationCompleted]: z.object({
    marketplace: marketplaceCodeSchema,
    accountId: z.string(),
    syncId: z.string(),
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    deleted: z.number().int().nonnegative(),
    restored: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    conflicts: z.number().int().nonnegative(),
    completedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceSynchronizationFailed]: z.object({
    marketplace: marketplaceCodeSchema,
    accountId: z.string(),
    syncId: z.string(),
    error: z.string(),
    failedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceCapabilityChanged]: z.object({
    marketplace: marketplaceCodeSchema,
    capability: z.string(),
    supported: z.boolean(),
    changedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceHealthChanged]: z.object({
    marketplace: marketplaceCodeSchema,
    accountId: z.string().nullable(),
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    latencyMs: z.number().int().nonnegative(),
    changedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceRegionUpdated]: z.object({
    marketplace: marketplaceCodeSchema,
    regionId: z.string(),
    name: z.string(),
    updatedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceCategoryUpdated]: z.object({
    marketplace: marketplaceCodeSchema,
    categoryId: z.string(),
    name: z.string(),
    parentId: z.string().nullable(),
    updatedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceLimitsChanged]: z.object({
    marketplace: marketplaceCodeSchema,
    accountId: z.string(),
    limits: z.record(z.number()),
    changedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceStatisticsImported]: z.object({
    marketplace: marketplaceCodeSchema,
    accountId: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    metrics: z.record(z.number()),
    importedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplaceWebhookReceived]: z.object({
    marketplace: marketplaceCodeSchema,
    accountId: z.string().nullable(),
    kind: z.string(),
    payloadHash: z.string(),
    receivedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplacePluginInstalled]: z.object({
    pluginId: z.string(),
    pluginVersion: z.string(),
    marketplace: marketplaceCodeSchema.nullable(),
    installedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplacePluginRemoved]: z.object({
    pluginId: z.string(),
    removedAt: z.string().datetime(),
  }),
  [MarketplaceEventType.MarketplacePluginUpdated]: z.object({
    pluginId: z.string(),
    fromVersion: z.string(),
    toVersion: z.string(),
    updatedAt: z.string().datetime(),
  }),
} as const;

/** Organization aggregate events (maps to tenant in persistence). */
export const OrganizationEventType = {
  OrganizationCreated: 'organization.created',
  OrganizationSettingsUpdated: 'organization.settings_updated',
  OrganizationBudgetAllocated: 'organization.budget_allocated',
  OrganizationAiSettingsUpdated: 'organization.ai_settings_updated',
  OrganizationApiKeyCreated: 'organization.api_key_created',
  OrganizationApiKeyRevoked: 'organization.api_key_revoked',
} as const;

export type OrganizationEventType = (typeof OrganizationEventType)[keyof typeof OrganizationEventType];

export const organizationEventCatalog = {
  [OrganizationEventType.OrganizationCreated]: z.object({
    name: z.string(),
    slug: z.string(),
  }),
  [OrganizationEventType.OrganizationSettingsUpdated]: z.object({
    settings: z.record(z.unknown()),
    updatedAt: z.string().datetime(),
  }),
  [OrganizationEventType.OrganizationBudgetAllocated]: z.object({
    budgetId: z.string(),
    amount: money,
    period: z.enum(['daily', 'weekly', 'monthly']),
    allocatedAt: z.string().datetime(),
  }),
  [OrganizationEventType.OrganizationAiSettingsUpdated]: z.object({
    models: z.record(z.string()),
    updatedAt: z.string().datetime(),
  }),
  [OrganizationEventType.OrganizationApiKeyCreated]: z.object({
    keyId: z.string(),
    name: z.string(),
    prefix: z.string(),
    createdAt: z.string().datetime(),
  }),
  [OrganizationEventType.OrganizationApiKeyRevoked]: z.object({
    keyId: z.string(),
    revokedAt: z.string().datetime(),
  }),
} as const;

/** Marketplace account aggregate events. */
export const AccountEventType = {
  AccountCreated: 'account.created',
  AccountAuthorized: 'account.authorized',
  AccountAuthorizationFailed: 'account.authorization_failed',
  AccountStatusChanged: 'account.status_changed',
  AccountLimitsUpdated: 'account.limits_updated',
  AccountSyncStarted: 'account.sync_started',
  AccountSyncCompleted: 'account.sync_completed',
  AccountSyncFailed: 'account.sync_failed',
  AccountHealthChanged: 'account.health_changed',
  AccountErrorRecorded: 'account.error_recorded',
} as const;

export type AccountEventType = (typeof AccountEventType)[keyof typeof AccountEventType];

export const AccountStatus = {
  PENDING: 'pending',
  AUTHORIZING: 'authorizing',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ERROR: 'error',
  DISCONNECTED: 'disconnected',
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];
export const accountStatusSchema = z.enum([
  AccountStatus.PENDING,
  AccountStatus.AUTHORIZING,
  AccountStatus.ACTIVE,
  AccountStatus.SUSPENDED,
  AccountStatus.ERROR,
  AccountStatus.DISCONNECTED,
]);

export const accountEventCatalog = {
  [AccountEventType.AccountCreated]: z.object({
    organizationId: z.string(),
    marketplace: marketplaceCodeSchema,
    displayName: z.string(),
    createdAt: z.string().datetime(),
  }),
  [AccountEventType.AccountAuthorized]: z.object({
    externalAccountId: z.string(),
    tokenExpiresAt: z.string().datetime().nullable(),
    authorizedAt: z.string().datetime(),
  }),
  [AccountEventType.AccountAuthorizationFailed]: z.object({
    reason: z.string(),
    failedAt: z.string().datetime(),
  }),
  [AccountEventType.AccountStatusChanged]: z.object({
    from: accountStatusSchema,
    to: accountStatusSchema,
    reason: z.string().nullable().default(null),
  }),
  [AccountEventType.AccountLimitsUpdated]: z.object({
    limits: z.record(z.number()),
    updatedAt: z.string().datetime(),
  }),
  [AccountEventType.AccountSyncStarted]: z.object({
    syncId: z.string(),
    mode: z.enum(['full', 'incremental', 'reconcile']),
    startedAt: z.string().datetime(),
  }),
  [AccountEventType.AccountSyncCompleted]: z.object({
    syncId: z.string(),
    stats: z.object({
      created: z.number().int(),
      updated: z.number().int(),
      deleted: z.number().int(),
      restored: z.number().int(),
      skipped: z.number().int(),
      conflicts: z.number().int(),
    }),
    completedAt: z.string().datetime(),
  }),
  [AccountEventType.AccountSyncFailed]: z.object({
    syncId: z.string(),
    error: z.string(),
    failedAt: z.string().datetime(),
  }),
  [AccountEventType.AccountHealthChanged]: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    latencyMs: z.number().int().nonnegative(),
    changedAt: z.string().datetime(),
  }),
  [AccountEventType.AccountErrorRecorded]: z.object({
    code: z.string(),
    message: z.string(),
    recoverable: z.boolean(),
    recordedAt: z.string().datetime(),
  }),
} as const;

/** Recommendation engine events. */
export const RecommendationEventType = {
  RecommendationGenerated: 'recommendation.generated',
  RecommendationAccepted: 'recommendation.accepted',
  RecommendationDismissed: 'recommendation.dismissed',
} as const;

export type RecommendationEventType = (typeof RecommendationEventType)[keyof typeof RecommendationEventType];

export const RecommendationKind = {
  BOOST: 'boost',
  CHANGE_PRICE: 'change_price',
  CHANGE_PHOTO: 'change_photo',
  CHANGE_DESCRIPTION: 'change_description',
  ADD_VIDEO: 'add_video',
  DISABLE_REGION: 'disable_region',
  INCREASE_BUDGET: 'increase_budget',
  CHANGE_CATEGORY: 'change_category',
} as const;
export type RecommendationKind = (typeof RecommendationKind)[keyof typeof RecommendationKind];

export const recommendationEventCatalog = {
  [RecommendationEventType.RecommendationGenerated]: z.object({
    entityType: z.string(),
    entityId: z.string(),
    kind: z.enum([
      RecommendationKind.BOOST,
      RecommendationKind.CHANGE_PRICE,
      RecommendationKind.CHANGE_PHOTO,
      RecommendationKind.CHANGE_DESCRIPTION,
      RecommendationKind.ADD_VIDEO,
      RecommendationKind.DISABLE_REGION,
      RecommendationKind.INCREASE_BUDGET,
      RecommendationKind.CHANGE_CATEGORY,
    ]),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
    payload: z.record(z.unknown()).default({}),
    generatedAt: z.string().datetime(),
  }),
  [RecommendationEventType.RecommendationAccepted]: z.object({
    recommendationId: z.string(),
    acceptedAt: z.string().datetime(),
  }),
  [RecommendationEventType.RecommendationDismissed]: z.object({
    recommendationId: z.string(),
    reason: z.string().nullable(),
    dismissedAt: z.string().datetime(),
  }),
} as const;

/** Snapshot events. */
export const SnapshotEventType = {
  SnapshotCreated: 'snapshot.created',
} as const;

export type SnapshotEventType = (typeof SnapshotEventType)[keyof typeof SnapshotEventType];

export const snapshotEventCatalog = {
  [SnapshotEventType.SnapshotCreated]: z.object({
    aggregateType: z.string(),
    aggregateId: z.string(),
    streamVersion: z.number().int().nonnegative(),
    schemaVersion: z.number().int().positive(),
    createdAt: z.string().datetime(),
  }),
} as const;
