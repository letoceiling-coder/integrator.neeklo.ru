import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiEventType, AiTaskType } from '@neeklo/contracts';
import type { AiRunRequestDto, AiRunResponseDto } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AiEventPublisher } from '../events/ai-event.publisher';
import { AiRouterService } from '../router/ai-router.service';
import { PlannerEngine } from '../planner/planner.engine';
import { ReasoningEngine } from '../reasoning/reasoning.engine';
import { AgentRuntimeService } from '../agents/agent-runtime.service';
import { ToolRuntimeService } from '../tools/tool-runtime.service';
import { PromptRegistryService } from '../prompts/prompt-registry.service';
import { MemoryV2Service } from '../memory/memory-v2.service';
import { EvaluationEngine, OptimizationEngine, LearningEngine } from '../learning/learning-engines.service';
import { OpenRouterClient } from '../../ai/openrouter.client';
import type { GatewayContext } from '../gateway/ai-gateway.service';

const ROLE_MAP: Partial<Record<AiTaskType, Parameters<OpenRouterClient['chat']>[0]>> = {
  [AiTaskType.CHAT]: 'chat',
  [AiTaskType.ANALYTICS]: 'analytics',
  [AiTaskType.LISTING]: 'listing',
  [AiTaskType.SUMMARY]: 'summary',
  [AiTaskType.VISION]: 'vision',
  [AiTaskType.OCR]: 'ocr',
};

/**
 * AI Orchestrator — coordinates planner, reasoning, agents, tools, and model execution.
 */
@Injectable()
export class AiOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: AiEventPublisher,
    private readonly router: AiRouterService,
    private readonly planner: PlannerEngine,
    private readonly reasoning: ReasoningEngine,
    private readonly agents: AgentRuntimeService,
    private readonly tools: ToolRuntimeService,
    private readonly prompts: PromptRegistryService,
    private readonly memory: MemoryV2Service,
    private readonly evaluation: EvaluationEngine,
    private readonly learning: LearningEngine,
    private readonly optimization: OptimizationEngine,
    private readonly openrouter: OpenRouterClient,
  ) {}

  async run(request: AiRunRequestDto, ctx: GatewayContext): Promise<AiRunResponseDto> {
    const route = await this.router.route(ctx.tenantId, request.taskType);
    const agent = request.agentId ? await this.agents.resolve(ctx.tenantId, request.agentId) : null;

    await this.prisma.aiRunReadModel.create({
      data: {
        id: ctx.runId,
        tenantId: ctx.tenantId,
        taskType: request.taskType,
        agentId: agent?.id ?? null,
        model: route.model,
        status: 'running',
        inputPreview: request.input.slice(0, 500),
        startedAt: new Date(),
      },
    });

    await this.publisher.publish(ctx.tenantId, `runs:${ctx.runId}`, AiEventType.RunStarted, {
      runId: ctx.runId,
      taskType: request.taskType,
      agentId: agent?.id ?? null,
      model: route.model,
      inputHash: Buffer.from(request.input).toString('base64').slice(0, 32),
      startedAt: new Date().toISOString(),
    });

    const plan = await this.planner.createPlan(ctx, request);
    const reasoningCtx = await this.reasoning.buildContext(ctx.tenantId, request);
    const memoryCtx = await this.memory.buildContext(ctx.tenantId, request.context);
    const prompt = await this.prompts.resolve(ctx.tenantId, request.taskType, agent?.systemPromptId ?? undefined);

    const systemParts = [prompt.template, reasoningCtx, memoryCtx].filter(Boolean).join('\n\n');
    const toolCalls: { name: string; success: boolean }[] = [];

    for (const step of plan.steps) {
      if (step.kind === 'tool' && step.toolName) {
        try {
          await this.tools.invoke(step.toolName, step.input ?? {}, {
            tenantId: ctx.tenantId,
            actorId: ctx.actorId,
            correlationId: ctx.correlationId,
            runId: ctx.runId,
          });
          toolCalls.push({ name: step.toolName, success: true });
        } catch {
          toolCalls.push({ name: step.toolName, success: false });
        }
      }
    }

    const role = ROLE_MAP[request.taskType] ?? 'chat';
    const completion = await this.openrouter.chat(role, [
      { role: 'system', content: systemParts },
      { role: 'user', content: request.input },
    ]);

    const costUsd = this.estimateCost(completion.tokensIn, completion.tokensOut, route.estimatedCostPer1kTokens);

    await this.prisma.aiRunReadModel.update({
      where: { id: ctx.runId },
      data: {
        status: 'completed',
        outputPreview: completion.text.slice(0, 1000),
        planId: plan.planId,
        tokensIn: completion.tokensIn,
        tokensOut: completion.tokensOut,
        latencyMs: completion.latencyMs,
        costUsd,
        toolCalls,
        completedAt: new Date(),
      },
    });

    await this.publisher.publish(ctx.tenantId, `runs:${ctx.runId}`, AiEventType.RunCompleted, {
      runId: ctx.runId,
      outputPreview: completion.text.slice(0, 200),
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      latencyMs: completion.latencyMs,
      costUsd,
      completedAt: new Date().toISOString(),
    });

    await this.publisher.publish(ctx.tenantId, `runs:${ctx.runId}`, AiEventType.CostRecorded, {
      runId: ctx.runId,
      model: completion.model,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      costUsd,
      recordedAt: new Date().toISOString(),
    });

    if (agent) {
      await this.agents.recordRun(agent.id);
      await this.publisher.publish(ctx.tenantId, `runs:${ctx.runId}`, AiEventType.AgentInvoked, {
        runId: ctx.runId,
        agentId: agent.id,
        agentVersion: agent.version,
        role: agent.role,
        invokedAt: new Date().toISOString(),
      });
    }

    const evalResult = await this.evaluation.evaluate(ctx, completion, toolCalls);
    await this.learning.record(ctx.tenantId, request.taskType, evalResult, ctx.runId);
    await this.optimization.analyze(ctx.tenantId, evalResult);

    await this.memory.store(ctx.tenantId, 'long', 'ai_run', ctx.runId, completion.text.slice(0, 500));

    return {
      runId: ctx.runId,
      output: completion.text,
      model: completion.model,
      agentId: agent?.id ?? null,
      planId: plan.planId,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      latencyMs: completion.latencyMs,
      costUsd,
      toolCalls,
    };
  }

  private estimateCost(tokensIn: number, tokensOut: number, costPer1k: number): number {
    return ((tokensIn + tokensOut) / 1000) * costPer1k;
  }
}
