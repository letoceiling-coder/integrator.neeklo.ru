import { z } from 'zod';
import { marketplaceCodeSchema } from '../marketplace';

/** Unified inbox channel — platform-agnostic. */
export const InboxChannel = {
  AVITO: 'avito',
  TELEGRAM: 'telegram',
  MAX: 'max',
  WHATSAPP: 'whatsapp',
  VK: 'vk',
  EMAIL: 'email',
  WEB_CHAT: 'web_chat',
} as const;
export type InboxChannel = (typeof InboxChannel)[keyof typeof InboxChannel];
export const inboxChannelSchema = z.enum([
  InboxChannel.AVITO,
  InboxChannel.TELEGRAM,
  InboxChannel.MAX,
  InboxChannel.WHATSAPP,
  InboxChannel.VK,
  InboxChannel.EMAIL,
  InboxChannel.WEB_CHAT,
]);

export const ConversationStatus = {
  OPEN: 'open',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  ARCHIVED: 'archived',
} as const;
export type ConversationStatus = (typeof ConversationStatus)[keyof typeof ConversationStatus];

export const DealStage = {
  LEAD: 'lead',
  INTERESTED: 'interested',
  NEGOTIATION: 'negotiation',
  OFFER: 'offer',
  RESERVED: 'reserved',
  PAID: 'paid',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type DealStage = (typeof DealStage)[keyof typeof DealStage];
export const dealStageSchema = z.enum([
  DealStage.LEAD,
  DealStage.INTERESTED,
  DealStage.NEGOTIATION,
  DealStage.OFFER,
  DealStage.RESERVED,
  DealStage.PAID,
  DealStage.COMPLETED,
  DealStage.CANCELLED,
]);

export const TaskPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const MediaJobKind = {
  GENERATE_IMAGE: 'generate_image',
  REMOVE_BACKGROUND: 'remove_background',
  ENHANCE: 'enhance',
  INFOGRAPHIC: 'infographic',
  BANNER: 'banner',
  COVER: 'cover',
  COLLAGE: 'collage',
  WATERMARK: 'watermark',
  RESIZE: 'resize',
  PRESENTATION: 'presentation',
  PDF: 'pdf',
  VIDEO: 'video',
} as const;

export const NotificationSource = {
  TELEGRAM: 'telegram',
  MAX: 'max',
  EMAIL: 'email',
  PUSH: 'push',
  WEBSOCKET: 'websocket',
  MARKETPLACE: 'marketplace',
  AI: 'ai',
  WORKFLOW: 'workflow',
  FORECAST: 'forecast',
  DECISION: 'decision',
} as const;

/** Commerce layer domain events — Release 0.4 */
export const CommerceEventType = {
  // Conversation / Unified Inbox
  ConversationStarted: 'conversation.started',
  ConversationPinned: 'conversation.pinned',
  ConversationUnpinned: 'conversation.unpinned',
  ConversationTagged: 'conversation.tagged',
  ConversationStatusChanged: 'conversation.status_changed',
  ConversationAssigned: 'conversation.assigned',
  ConversationAiSummaryGenerated: 'conversation.ai_summary_generated',
  // Customer 360
  CustomerCreated: 'customer.created',
  CustomerUpdated: 'customer.updated',
  CustomerInterestRecorded: 'customer.interest_recorded',
  // Deal pipeline (extends deal.*)
  DealStageChanged: 'deal.stage_changed',
  DealOfferMade: 'deal.offer_made',
  DealReserved: 'deal.reserved',
  DealPaid: 'deal.paid',
  DealCompleted: 'deal.completed',
  DealCancelled: 'deal.cancelled',
  DealAiStageSuggested: 'deal.ai_stage_suggested',
  // Tasks
  TaskCreated: 'task.created',
  TaskCompleted: 'task.completed',
  TaskAssigned: 'task.assigned',
  // Notifications
  NotificationCreated: 'notification.created',
  NotificationRead: 'notification.read',
  // Media studio / jobs
  MediaJobCreated: 'media.job_created',
  MediaJobCompleted: 'media.job_completed',
  MediaJobFailed: 'media.job_failed',
  // Calendar
  CalendarEventScheduled: 'calendar.event_scheduled',
  CalendarEventCompleted: 'calendar.event_completed',
  // Automation
  AutomationCreated: 'automation.created',
  AutomationExecuted: 'automation.executed',
  // Listing studio
  ListingBulkUpdated: 'listing.bulk_updated',
  ListingHistoryRecorded: 'listing.history_recorded',
} as const;
export type CommerceEventType = (typeof CommerceEventType)[keyof typeof CommerceEventType];

const money = z.object({ amount: z.number().int(), currency: z.string().default('RUB') });

export const commerceEventCatalog = {
  [CommerceEventType.ConversationStarted]: z.object({
    channel: inboxChannelSchema,
    customerId: z.string(),
    adId: z.string().nullable().default(null),
    subject: z.string().default(''),
    externalThreadId: z.string().nullable().default(null),
  }),
  [CommerceEventType.ConversationPinned]: z.object({ pinned: z.boolean().default(true) }),
  [CommerceEventType.ConversationUnpinned]: z.object({}),
  [CommerceEventType.ConversationTagged]: z.object({
    tag: z.string(),
    action: z.enum(['add', 'remove']).default('add'),
  }),
  [CommerceEventType.ConversationStatusChanged]: z.object({
    from: z.string(),
    to: z.string(),
    reason: z.string().nullable().default(null),
  }),
  [CommerceEventType.ConversationAssigned]: z.object({
    assigneeId: z.string(),
    assigneeName: z.string().nullable().default(null),
  }),
  [CommerceEventType.ConversationAiSummaryGenerated]: z.object({
    summary: z.string(),
    model: z.string().default('default'),
    generatedAt: z.string().datetime(),
  }),
  [CommerceEventType.CustomerCreated]: z.object({
    displayName: z.string(),
    phone: z.string().nullable().default(null),
    email: z.string().nullable().default(null),
    channel: inboxChannelSchema,
    externalId: z.string().nullable().default(null),
    cityIds: z.array(z.string()).default([]),
  }),
  [CommerceEventType.CustomerUpdated]: z.object({
    displayName: z.string().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    cityIds: z.array(z.string()).optional(),
    preferences: z.record(z.unknown()).optional(),
  }),
  [CommerceEventType.CustomerInterestRecorded]: z.object({
    categoryId: z.string().nullable().default(null),
    adId: z.string().nullable().default(null),
    interest: z.string(),
    score: z.number().min(0).max(100).default(50),
  }),
  [CommerceEventType.DealStageChanged]: z.object({
    from: dealStageSchema,
    to: dealStageSchema,
    reason: z.string().nullable().default(null),
    suggestedByAi: z.boolean().default(false),
  }),
  [CommerceEventType.DealOfferMade]: z.object({
    amount: money,
    validUntil: z.string().datetime().nullable().default(null),
  }),
  [CommerceEventType.DealReserved]: z.object({
    reservedUntil: z.string().datetime(),
    deposit: money.nullable().default(null),
  }),
  [CommerceEventType.DealPaid]: z.object({
    amount: money,
    paidAt: z.string().datetime(),
  }),
  [CommerceEventType.DealCompleted]: z.object({
    amount: money,
    completedAt: z.string().datetime(),
  }),
  [CommerceEventType.DealCancelled]: z.object({
    reason: z.string(),
    cancelledAt: z.string().datetime(),
  }),
  [CommerceEventType.DealAiStageSuggested]: z.object({
    suggestedStage: dealStageSchema,
    confidence: z.number().min(0).max(1),
    reason: z.string(),
  }),
  [CommerceEventType.TaskCreated]: z.object({
    title: z.string(),
    description: z.string().default(''),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    entityType: z.string().nullable().default(null),
    entityId: z.string().nullable().default(null),
    dueAt: z.string().datetime().nullable().default(null),
    createdByAi: z.boolean().default(false),
  }),
  [CommerceEventType.TaskCompleted]: z.object({
    completedAt: z.string().datetime(),
    outcome: z.string().nullable().default(null),
  }),
  [CommerceEventType.TaskAssigned]: z.object({
    assigneeId: z.string(),
  }),
  [CommerceEventType.NotificationCreated]: z.object({
    source: z.string(),
    category: z.string(),
    title: z.string(),
    body: z.string(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    entityType: z.string().nullable().default(null),
    entityId: z.string().nullable().default(null),
    scheduledAt: z.string().datetime().nullable().default(null),
  }),
  [CommerceEventType.NotificationRead]: z.object({
    readAt: z.string().datetime(),
  }),
  [CommerceEventType.MediaJobCreated]: z.object({
    kind: z.string(),
    input: z.record(z.unknown()).default({}),
    entityType: z.string().nullable().default(null),
    entityId: z.string().nullable().default(null),
  }),
  [CommerceEventType.MediaJobCompleted]: z.object({
    outputUrl: z.string().url(),
    completedAt: z.string().datetime(),
  }),
  [CommerceEventType.MediaJobFailed]: z.object({
    error: z.string(),
    failedAt: z.string().datetime(),
  }),
  [CommerceEventType.CalendarEventScheduled]: z.object({
    kind: z.enum(['publication', 'boost', 'vip', 'promotion_end', 'deal', 'meeting', 'task', 'reminder']),
    title: z.string(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().default(null),
    entityType: z.string().nullable().default(null),
    entityId: z.string().nullable().default(null),
  }),
  [CommerceEventType.CalendarEventCompleted]: z.object({
    completedAt: z.string().datetime(),
  }),
  [CommerceEventType.AutomationCreated]: z.object({
    name: z.string(),
    definition: z.record(z.unknown()),
    enabled: z.boolean().default(true),
  }),
  [CommerceEventType.AutomationExecuted]: z.object({
    automationId: z.string(),
    triggerEventType: z.string(),
    executedAt: z.string().datetime(),
    outcome: z.enum(['success', 'skipped', 'failed']),
  }),
  [CommerceEventType.ListingBulkUpdated]: z.object({
    adIds: z.array(z.string()),
    field: z.string(),
    count: z.number().int().positive(),
  }),
  [CommerceEventType.ListingHistoryRecorded]: z.object({
    adId: z.string(),
    changeType: z.string(),
    snapshot: z.record(z.unknown()).default({}),
  }),
} as const;
