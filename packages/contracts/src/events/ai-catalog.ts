import { z } from 'zod';

/** AI task types for model routing. */
export const AiTaskType = {
  CHAT: 'chat',
  ANALYTICS: 'analytics',
  LISTING: 'listing',
  VISION: 'vision',
  OCR: 'ocr',
  SUMMARY: 'summary',
  REASONING: 'reasoning',
  PLANNING: 'planning',
  TOOL: 'tool',
  EVALUATION: 'evaluation',
} as const;
export type AiTaskType = (typeof AiTaskType)[keyof typeof AiTaskType];
export const aiTaskTypeSchema = z.enum([
  AiTaskType.CHAT,
  AiTaskType.ANALYTICS,
  AiTaskType.LISTING,
  AiTaskType.VISION,
  AiTaskType.OCR,
  AiTaskType.SUMMARY,
  AiTaskType.REASONING,
  AiTaskType.PLANNING,
  AiTaskType.TOOL,
  AiTaskType.EVALUATION,
]);

/** Memory tier for Memory Engine v2. */
export const MemoryTier = {
  SHORT: 'short',
  LONG: 'long',
  SEMANTIC: 'semantic',
  CONVERSATION: 'conversation',
  BUSINESS: 'business',
  MARKETPLACE: 'marketplace',
  CUSTOMER: 'customer',
  KNOWLEDGE: 'knowledge',
} as const;
export type MemoryTier = (typeof MemoryTier)[keyof typeof MemoryTier];

/** Agent roles in Agent Runtime. */
export const AgentRole = {
  SUPERVISOR: 'supervisor',
  WORKER: 'worker',
  PLANNER: 'planner',
  REVIEWER: 'reviewer',
  SPECIALIST: 'specialist',
} as const;
export type AgentRole = (typeof AgentRole)[keyof typeof AgentRole];

/** AI platform domain events — aggregate stream: `ai`. */
export const AiEventType = {
  RunStarted: 'ai.run_started',
  RunCompleted: 'ai.run_completed',
  RunFailed: 'ai.run_failed',
  PlanCreated: 'ai.plan_created',
  StepCompleted: 'ai.step_completed',
  ToolInvoked: 'ai.tool_invoked',
  PromptUsed: 'ai.prompt_used',
  EvaluationRecorded: 'ai.evaluation_recorded',
  LearningRecorded: 'ai.learning_recorded',
  CostRecorded: 'ai.cost_recorded',
  AgentInvoked: 'ai.agent_invoked',
  SkillApplied: 'ai.skill_applied',
} as const;
export type AiEventType = (typeof AiEventType)[keyof typeof AiEventType];

export const aiEventCatalog = {
  [AiEventType.RunStarted]: z.object({
    runId: z.string(),
    taskType: aiTaskTypeSchema,
    agentId: z.string().nullable().default(null),
    model: z.string(),
    inputHash: z.string(),
    startedAt: z.string().datetime(),
  }),
  [AiEventType.RunCompleted]: z.object({
    runId: z.string(),
    outputPreview: z.string(),
    tokensIn: z.number().int().nonnegative(),
    tokensOut: z.number().int().nonnegative(),
    latencyMs: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    completedAt: z.string().datetime(),
  }),
  [AiEventType.RunFailed]: z.object({
    runId: z.string(),
    error: z.string(),
    failedAt: z.string().datetime(),
  }),
  [AiEventType.PlanCreated]: z.object({
    planId: z.string(),
    runId: z.string(),
    stepCount: z.number().int().positive(),
    dag: z.record(z.unknown()).default({}),
    createdAt: z.string().datetime(),
  }),
  [AiEventType.StepCompleted]: z.object({
    planId: z.string(),
    stepId: z.string(),
    status: z.enum(['success', 'skipped', 'failed']),
    completedAt: z.string().datetime(),
  }),
  [AiEventType.ToolInvoked]: z.object({
    runId: z.string(),
    toolName: z.string(),
    toolVersion: z.string().default('1'),
    durationMs: z.number().int().nonnegative(),
    success: z.boolean(),
    invokedAt: z.string().datetime(),
  }),
  [AiEventType.PromptUsed]: z.object({
    runId: z.string(),
    promptId: z.string(),
    promptVersion: z.string(),
    tokensIn: z.number().int().nonnegative(),
    usedAt: z.string().datetime(),
  }),
  [AiEventType.EvaluationRecorded]: z.object({
    runId: z.string(),
    quality: z.number().min(0).max(1),
    usefulness: z.number().min(0).max(1),
    accuracy: z.number().min(0).max(1),
    costEfficiency: z.number().min(0).max(1),
    recordedAt: z.string().datetime(),
  }),
  [AiEventType.LearningRecorded]: z.object({
    category: z.string(),
    insight: z.string(),
    confidence: z.number().min(0).max(1),
    recordedAt: z.string().datetime(),
  }),
  [AiEventType.CostRecorded]: z.object({
    runId: z.string(),
    model: z.string(),
    tokensIn: z.number().int().nonnegative(),
    tokensOut: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    recordedAt: z.string().datetime(),
  }),
  [AiEventType.AgentInvoked]: z.object({
    runId: z.string(),
    agentId: z.string(),
    agentVersion: z.string(),
    role: z.string(),
    invokedAt: z.string().datetime(),
  }),
  [AiEventType.SkillApplied]: z.object({
    runId: z.string(),
    skillId: z.string(),
    appliedAt: z.string().datetime(),
  }),
} as const;
