import { z } from 'zod';
import { dealStageSchema, inboxChannelSchema } from '../events/commerce-catalog';
import { marketplaceCodeSchema } from '../marketplace';

const money = z.object({ amount: z.number().int(), currency: z.string().default('RUB') });

export const conversationReadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  channel: inboxChannelSchema,
  customerId: z.string(),
  customerName: z.string(),
  adId: z.string().nullable(),
  adTitle: z.string().nullable(),
  status: z.string(),
  subject: z.string(),
  pinned: z.boolean(),
  tags: z.array(z.string()),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  unreadCount: z.number().int(),
  lastMessageAt: z.string().datetime().nullable(),
  lastMessagePreview: z.string(),
  aiSummary: z.string().nullable(),
  updatedAt: z.string().datetime(),
});
export type ConversationReadModel = z.infer<typeof conversationReadSchema>;

export const messageReadSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  direction: z.enum(['inbound', 'outbound', 'ai']),
  text: z.string(),
  attachments: z.array(z.string()),
  senderName: z.string().nullable(),
  isAi: z.boolean(),
  sentAt: z.string().datetime(),
});
export type MessageReadModel = z.infer<typeof messageReadSchema>;

export const customerReadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  displayName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  channel: inboxChannelSchema,
  cityIds: z.array(z.string()),
  interests: z.array(z.string()),
  preferences: z.record(z.unknown()),
  aiScore: z.number(),
  purchaseProbability: z.number(),
  aiSummary: z.string().nullable(),
  totalDeals: z.number().int(),
  totalSpent: z.number().int(),
  conversationCount: z.number().int(),
  lastActivityAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type CustomerReadModel = z.infer<typeof customerReadSchema>;

export const dealReadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  adId: z.string().nullable(),
  adTitle: z.string().nullable(),
  stage: dealStageSchema,
  expectedAmount: money,
  actualAmount: money.nullable(),
  assigneeId: z.string().nullable(),
  aiSuggestedStage: dealStageSchema.nullable(),
  aiConfidence: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
});
export type DealReadModel = z.infer<typeof dealReadSchema>;

export const taskReadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  status: z.enum(['open', 'completed', 'cancelled']),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  dueAt: z.string().datetime().nullable(),
  createdByAi: z.boolean(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type TaskReadModel = z.infer<typeof taskReadSchema>;

export const notificationReadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  source: z.string(),
  category: z.string(),
  title: z.string(),
  body: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  read: z.boolean(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type NotificationReadModel = z.infer<typeof notificationReadSchema>;

export const sendMessageSchema = z.object({
  text: z.string().min(1).max(10000),
  attachments: z.array(z.string()).default([]),
});
export type SendMessageDto = z.infer<typeof sendMessageSchema>;

export const createDealSchema = z.object({
  customerId: z.string(),
  adId: z.string().nullable().default(null),
  expectedAmount: money,
});
export type CreateDealDto = z.infer<typeof createDealSchema>;

export const changeDealStageSchema = z.object({
  stage: dealStageSchema,
  reason: z.string().nullable().default(null),
});
export type ChangeDealStageDto = z.infer<typeof changeDealStageSchema>;

export const createMediaJobSchema = z.object({
  kind: z.string(),
  input: z.record(z.unknown()).default({}),
  entityType: z.string().nullable().default(null),
  entityId: z.string().nullable().default(null),
});
export type CreateMediaJobDto = z.infer<typeof createMediaJobSchema>;

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  types: z.array(z.string()).optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
export type SearchQueryDto = z.infer<typeof searchQuerySchema>;

export const timelineQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type TimelineQueryDto = z.infer<typeof timelineQuerySchema>;

export const automationDefinitionSchema = z.object({
  name: z.string().min(1),
  nodes: z.array(z.record(z.unknown())),
  edges: z.array(z.record(z.unknown())),
  enabled: z.boolean().default(true),
});
export type AutomationDefinitionDto = z.infer<typeof automationDefinitionSchema>;
