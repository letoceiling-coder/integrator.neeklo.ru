import { z } from 'zod';
import { aiTaskTypeSchema } from '../events/ai-catalog';

export const aiRunRequestSchema = z.object({
  taskType: aiTaskTypeSchema,
  input: z.string().min(1).max(50000),
  agentId: z.string().optional(),
  skillIds: z.array(z.string()).default([]),
  toolNames: z.array(z.string()).optional(),
  context: z.record(z.unknown()).default({}),
  maxSteps: z.number().int().positive().max(20).default(5),
});
export type AiRunRequestDto = z.infer<typeof aiRunRequestSchema>;

export const aiRunResponseSchema = z.object({
  runId: z.string(),
  output: z.string(),
  model: z.string(),
  agentId: z.string().nullable(),
  planId: z.string().nullable(),
  tokensIn: z.number().int(),
  tokensOut: z.number().int(),
  latencyMs: z.number().int(),
  costUsd: z.number(),
  toolCalls: z.array(z.object({ name: z.string(), success: z.boolean() })),
});
export type AiRunResponseDto = z.infer<typeof aiRunResponseSchema>;

export const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  role: z.enum(['supervisor', 'worker', 'planner', 'reviewer', 'specialist']).default('worker'),
  skillIds: z.array(z.string()).default([]),
  toolNames: z.array(z.string()).default([]),
  modelPreference: aiTaskTypeSchema.optional(),
  systemPromptId: z.string().optional(),
});
export type CreateAgentDto = z.infer<typeof createAgentSchema>;

export const createPromptSchema = z.object({
  name: z.string().min(1),
  category: z.string().default('general'),
  template: z.string().min(1),
  tags: z.array(z.string()).default([]),
});
export type CreatePromptDto = z.infer<typeof createPromptSchema>;

export const agentReadSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string(),
  role: z.string(),
  skillIds: z.array(z.string()),
  toolNames: z.array(z.string()),
  modelPreference: z.string().nullable(),
  version: z.string(),
  rating: z.number(),
  runCount: z.number().int(),
  enabled: z.boolean(),
});
export type AgentReadModel = z.infer<typeof agentReadSchema>;

export const aiCostSummarySchema = z.object({
  totalCostUsd: z.number(),
  totalTokensIn: z.number().int(),
  totalTokensOut: z.number().int(),
  runCount: z.number().int(),
  byModel: z.array(z.object({ model: z.string(), costUsd: z.number(), runs: z.number().int() })),
  byAgent: z.array(z.object({ agentId: z.string(), costUsd: z.number(), runs: z.number().int() })),
});
export type AiCostSummaryDto = z.infer<typeof aiCostSummarySchema>;
