import { z } from 'zod';
import { adStatusSchema, marketplaceCodeSchema, promotionKindSchema } from '../marketplace';
import {
  AccountEventType,
  accountEventCatalog,
  MarketplaceEventType,
  marketplaceEventCatalog,
  OrganizationEventType,
  organizationEventCatalog,
  RecommendationEventType,
  recommendationEventCatalog,
  SnapshotEventType,
  snapshotEventCatalog,
} from './marketplace-catalog';
import {
  IntelligenceEventType,
  intelligenceEventCatalog,
  Granularity,
  StrategyType,
  DecisionAction,
} from './intelligence-catalog';
import {
  CommerceEventType,
  commerceEventCatalog,
  DealStage,
  dealStageSchema,
  InboxChannel,
  inboxChannelSchema,
  ConversationStatus,
} from './commerce-catalog';
import {
  AiEventType,
  aiEventCatalog,
  AiTaskType,
  aiTaskTypeSchema,
  MemoryTier,
  AgentRole,
} from './ai-catalog';
import {
  AvitoEventType,
  avitoEventCatalog,
  ListingPipelineStep,
  listingPipelineStepSchema,
} from './avito-catalog';

export {
  AccountEventType,
  AccountStatus,
  accountStatusSchema,
  MarketplaceEventType,
  OrganizationEventType,
  RecommendationEventType,
  RecommendationKind,
  SnapshotEventType,
} from './marketplace-catalog';
export { IntelligenceEventType, Granularity, StrategyType, DecisionAction } from './intelligence-catalog';
export {
  CommerceEventType,
  DealStage,
  dealStageSchema,
  InboxChannel,
  inboxChannelSchema,
  ConversationStatus,
} from './commerce-catalog';
export { AiEventType, AiTaskType, aiTaskTypeSchema, MemoryTier, AgentRole } from './ai-catalog';
export { AvitoEventType, ListingPipelineStep, listingPipelineStepSchema } from './avito-catalog';

/**
 * The single source of truth for every domain event NEEKLO can emit.
 */
export const EventType = {
  // ── Ad lifecycle ──────────────────────────────────────────────
  AdCreated: 'ad.created',
  AdPublished: 'ad.published',
  AdStatusChanged: 'ad.status_changed',
  PriceChanged: 'ad.price_changed',
  PhotoUpdated: 'ad.photo_updated',
  DescriptionChanged: 'ad.description_changed',
  AdArchived: 'ad.archived',
  AdSold: 'ad.sold',
  PromotionActivated: 'ad.promotion_activated',
  ViewRecorded: 'ad.view_recorded',
  FavoriteAdded: 'ad.favorite_added',
  ContactRecorded: 'ad.contact_recorded',
  // ── Messaging ─────────────────────────────────────────────────
  MessageReceived: 'conversation.message_received',
  MessageSent: 'conversation.message_sent',
  AIReplySent: 'conversation.ai_reply_sent',
  ConversationHandedOff: 'conversation.handed_off',
  // ── Money ─────────────────────────────────────────────────────
  BudgetSpent: 'budget.spent',
  // ── Deals ─────────────────────────────────────────────────────
  DealCreated: 'deal.created',
  DealWon: 'deal.won',
  DealLost: 'deal.lost',
  // ── Marketplace platform ────────────────────────────────────────
  ...MarketplaceEventType,
  // ── Organization ──────────────────────────────────────────────
  ...OrganizationEventType,
  // ── Account ───────────────────────────────────────────────────
  ...AccountEventType,
  // ── Recommendations ─────────────────────────────────────────────
  ...RecommendationEventType,
  // ── Snapshots ─────────────────────────────────────────────────
  ...SnapshotEventType,
  // ── Intelligence (Stage 3) ────────────────────────────────────
  ...IntelligenceEventType,
  // ── Commerce (Release 0.4) ────────────────────────────────────
  ...CommerceEventType,
  // ── AI Platform (Release 0.5) ─────────────────────────────────
  ...AiEventType,
  // ── Avito Enterprise (Release 0.6) ────────────────────────────
  ...AvitoEventType,
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

const money = z.object({ amount: z.number().int(), currency: z.string().default('RUB') });
const photoRef = z.object({ id: z.string(), url: z.string().url(), order: z.number().int().nonnegative() });

/** Payload schema per event type. Keys MUST match `EventType` values. */
export const eventCatalog = {
  [EventType.AdCreated]: z.object({
    marketplace: marketplaceCodeSchema,
    title: z.string().min(1),
    categoryId: z.string(),
    subcategoryId: z.string().nullable(),
    regionId: z.string(),
    cityId: z.string(),
    price: money,
    description: z.string().default(''),
    photos: z.array(photoRef).default([]),
    aiScore: z.number().min(0).max(100).nullable().default(null),
  }),
  [EventType.AdPublished]: z.object({
    marketplace: marketplaceCodeSchema,
    externalId: z.string(),
    url: z.string().url().nullable(),
    publishedAt: z.string().datetime(),
  }),
  [EventType.AdStatusChanged]: z.object({
    from: adStatusSchema,
    to: adStatusSchema,
    reason: z.string().nullable().default(null),
  }),
  [EventType.PriceChanged]: z.object({
    from: money,
    to: money,
    reason: z.string().nullable().default(null),
  }),
  [EventType.PhotoUpdated]: z.object({
    added: z.array(photoRef).default([]),
    removed: z.array(z.string()).default([]),
    reordered: z.array(photoRef).default([]),
  }),
  [EventType.DescriptionChanged]: z.object({
    fromLength: z.number().int().nonnegative(),
    toLength: z.number().int().nonnegative(),
    diffHash: z.string(),
  }),
  [EventType.AdArchived]: z.object({ reason: z.string().nullable().default(null) }),
  [EventType.AdSold]: z.object({
    price: money,
    dealId: z.string().nullable().default(null),
    soldAt: z.string().datetime(),
  }),
  [EventType.PromotionActivated]: z.object({
    kind: promotionKindSchema,
    cost: money,
    durationHours: z.number().int().positive(),
    activatedAt: z.string().datetime(),
  }),
  [EventType.ViewRecorded]: z.object({
    count: z.number().int().positive().default(1),
    source: z.string().nullable().default(null),
    at: z.string().datetime(),
  }),
  [EventType.FavoriteAdded]: z.object({ at: z.string().datetime() }),
  [EventType.ContactRecorded]: z.object({
    channel: z.enum(['phone', 'message', 'call']),
    at: z.string().datetime(),
  }),
  [EventType.MessageReceived]: z.object({
    conversationId: z.string(),
    marketplace: marketplaceCodeSchema,
    adId: z.string().nullable(),
    customerId: z.string(),
    text: z.string(),
    attachments: z.array(z.string()).default([]),
    receivedAt: z.string().datetime(),
  }),
  [EventType.MessageSent]: z.object({
    conversationId: z.string(),
    text: z.string(),
    sentAt: z.string().datetime(),
  }),
  [EventType.AIReplySent]: z.object({
    conversationId: z.string(),
    model: z.string(),
    text: z.string(),
    intent: z.string().nullable().default(null),
    tokensIn: z.number().int().nonnegative(),
    tokensOut: z.number().int().nonnegative(),
    latencyMs: z.number().int().nonnegative(),
    sentAt: z.string().datetime(),
  }),
  [EventType.ConversationHandedOff]: z.object({
    conversationId: z.string(),
    toUserId: z.string(),
    reason: z.string().nullable().default(null),
  }),
  [EventType.BudgetSpent]: z.object({
    marketplace: marketplaceCodeSchema,
    adId: z.string().nullable(),
    category: z.enum(['promotion', 'placement', 'commission', 'other']),
    amount: money,
    spentAt: z.string().datetime(),
  }),
  [EventType.DealCreated]: z.object({
    customerId: z.string(),
    adId: z.string().nullable(),
    expectedAmount: money,
  }),
  [EventType.DealWon]: z.object({ amount: money, closedAt: z.string().datetime() }),
  [EventType.DealLost]: z.object({ reason: z.string(), closedAt: z.string().datetime() }),
  ...marketplaceEventCatalog,
  ...organizationEventCatalog,
  ...accountEventCatalog,
  ...recommendationEventCatalog,
  ...snapshotEventCatalog,
  ...intelligenceEventCatalog,
  ...commerceEventCatalog,
  ...aiEventCatalog,
  ...avitoEventCatalog,
} as const satisfies Record<EventType, z.ZodTypeAny>;
export type EventPayloadMap = {
  [K in EventType]: z.infer<(typeof eventCatalog)[K]>;
};

/** Aggregate stream a given event type belongs to (derived from its namespace). */
export function aggregateTypeOf(type: EventType): string {
  return type.split('.')[0]!;
}

/** Validate & narrow an unknown payload for a given event type. Throws on mismatch. */
export function parseEventPayload<K extends EventType>(type: K, payload: unknown): EventPayloadMap[K] {
  return eventCatalog[type].parse(payload) as EventPayloadMap[K];
}

export function isEventType(value: string): value is EventType {
  return Object.prototype.hasOwnProperty.call(eventCatalog, value);
}
