import { z } from 'zod';

export const AvitoPipelineStage = {
  New: 'new',
  InProgress: 'in_progress',
  Waiting: 'waiting',
  Negotiation: 'negotiation',
  Offer: 'offer',
  Reserved: 'reserved',
  Sale: 'sale',
  Repeat: 'repeat',
  Closed: 'closed',
} as const;
export type AvitoPipelineStage = (typeof AvitoPipelineStage)[keyof typeof AvitoPipelineStage];

export const AVITO_PIPELINE_TO_DEAL: Record<AvitoPipelineStage, string> = {
  new: 'lead',
  in_progress: 'interested',
  waiting: 'interested',
  negotiation: 'negotiation',
  offer: 'offer',
  reserved: 'reserved',
  sale: 'paid',
  repeat: 'completed',
  closed: 'cancelled',
};

export const avitoPipelineStageSchema = z.enum([
  'new',
  'in_progress',
  'waiting',
  'negotiation',
  'offer',
  'reserved',
  'sale',
  'repeat',
  'closed',
]);

export interface AvitoLeadDto {
  id: string;
  customerId: string;
  customerName: string;
  phone: string | null;
  accountId: string | null;
  adId: string | null;
  adTitle: string | null;
  source: string;
  cityId: string | null;
  regionId: string | null;
  pipelineStage: AvitoPipelineStage;
  dealStage: string;
  assigneeId: string | null;
  assigneeName: string | null;
  aiScore: number;
  purchaseProbability: number;
  forecast: string | null;
  lastActivityAt: string | null;
  conversationId: string | null;
  dealId: string | null;
}

export interface AvitoPipelineColumnDto {
  stage: AvitoPipelineStage;
  label: string;
  leads: AvitoLeadDto[];
  count: number;
}

export interface AvitoCustomer360Dto {
  customer: Record<string, unknown>;
  conversations: unknown[];
  deals: unknown[];
  leads: AvitoLeadDto[];
  timeline: unknown[];
  graph: unknown;
  aiSummary: string | null;
  memory: unknown[];
  forecast: string | null;
  recommendations: { title: string; detail: string }[];
  ads: unknown[];
  payments: { dealId: string; amount: number; at: string }[];
}

export interface AvitoSmartInboxDto {
  conversations: unknown[];
  selectedConversation: unknown | null;
  messages: unknown[];
  customer360: AvitoCustomer360Dto | null;
  lead: AvitoLeadDto | null;
}

export const avitoSalesAgentConfigSchema = z.object({
  accountId: z.string().uuid(),
  enabled: z.boolean().default(true),
  workingHoursStart: z.number().int().min(0).max(23).default(9),
  workingHoursEnd: z.number().int().min(0).max(23).default(21),
  tone: z.enum(['formal', 'friendly', 'professional']).default('professional'),
  maxDiscountPct: z.number().min(0).max(100).default(10),
  maxPriceRub: z.number().int().positive().optional(),
  handoffToManager: z.boolean().default(true),
  useKnowledgeBase: z.boolean().default(true),
  useHistory: z.boolean().default(true),
  useCrm: z.boolean().default(true),
  useForecast: z.boolean().default(true),
  useDecisionEngine: z.boolean().default(true),
  useMemory: z.boolean().default(true),
});
export type AvitoSalesAgentConfigDto = z.infer<typeof avitoSalesAgentConfigSchema>;

export interface AvitoSmartReplyDto {
  id: string;
  text: string;
  tone: string;
  confidence: number;
}

export const avitoFollowUpRuleSchema = z.object({
  accountId: z.string().uuid().optional(),
  name: z.string(),
  delayDays: z.number().int().positive(),
  trigger: z.enum(['no_reply', 'deal_stale', 'post_sale']),
  enabled: z.boolean().default(true),
});
export type AvitoFollowUpRuleDto = z.infer<typeof avitoFollowUpRuleSchema>;

export const avitoDocumentCreateSchema = z.object({
  kind: z.enum(['proposal', 'contract', 'invoice', 'presentation']),
  dealId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  title: z.string(),
  content: z.string().max(50000),
});
export type AvitoDocumentCreateDto = z.infer<typeof avitoDocumentCreateSchema>;

export interface AvitoDealAnalysisDto {
  dealId: string;
  outcome: 'won' | 'lost' | 'open';
  whyBought: string | null;
  whyLost: string | null;
  improvements: string[];
  aiSummary: string;
  analyzedAt: string;
}

export interface AvitoSalesDashboardDto {
  conversionRate: number;
  totalSales: number;
  avgCheck: number;
  leadsCount: number;
  lostCount: number;
  funnel: { stage: string; count: number }[];
  roi: number;
  forecast: string;
  aiRecommendations: string[];
}

export const avitoPipelineMoveSchema = z.object({
  leadId: z.string().uuid(),
  stage: avitoPipelineStageSchema,
});
export type AvitoPipelineMoveDto = z.infer<typeof avitoPipelineMoveSchema>;

export const avitoSmartReplyRequestSchema = z.object({
  conversationId: z.string().uuid(),
  customerId: z.string().uuid(),
  adId: z.string().uuid().nullable().optional(),
  message: z.string(),
  accountId: z.string().uuid().optional(),
});
export type AvitoSmartReplyRequestDto = z.infer<typeof avitoSmartReplyRequestSchema>;

export const avitoCreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});
export type AvitoCreateTaskDto = z.infer<typeof avitoCreateTaskSchema>;
