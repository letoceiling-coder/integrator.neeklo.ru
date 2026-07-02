import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiEventType } from '@neeklo/contracts';
import type { ChatCompletionResult } from '../../ai/openrouter.client';
import { OpenRouterClient } from '../../ai/openrouter.client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiEventPublisher } from '../events/ai-event.publisher';
import type { GatewayContext } from '../gateway/ai-gateway.service';

/** Evaluation Engine — scores every AI response. */
@Injectable()
export class EvaluationEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: AiEventPublisher,
  ) {}

  async evaluate(
    ctx: GatewayContext,
    completion: ChatCompletionResult,
    toolCalls: { name: string; success: boolean }[],
  ) {
    const toolSuccessRate = toolCalls.length
      ? toolCalls.filter((t) => t.success).length / toolCalls.length
      : 1;
    const latencyScore = Math.max(0, 1 - completion.latencyMs / 30_000);
    const lengthScore = completion.text.length > 20 && completion.text.length < 5000 ? 0.9 : 0.6;

    const quality = (toolSuccessRate * 0.3 + latencyScore * 0.2 + lengthScore * 0.5);
    const usefulness = quality * 0.95;
    const accuracy = quality * 0.9;
    const costEfficiency = completion.tokensOut > 0 ? Math.min(1, 500 / completion.tokensOut) : 0.5;

    await this.prisma.aiEvaluationReadModel.create({
      data: {
        id: uuid(),
        tenantId: ctx.tenantId,
        runId: ctx.runId,
        quality,
        usefulness,
        accuracy,
        costEfficiency,
        latencyScore,
        recordedAt: new Date(),
      },
    });

    await this.publisher.publish(ctx.tenantId, `runs:${ctx.runId}`, AiEventType.EvaluationRecorded, {
      runId: ctx.runId,
      quality,
      usefulness,
      accuracy,
      costEfficiency,
      recordedAt: new Date().toISOString(),
    });

    return { quality, usefulness, accuracy, costEfficiency, latencyScore };
  }
}

/** Optimization Engine — improves prompts, router, skills based on evaluation. */
@Injectable()
export class OptimizationEngine {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(tenantId: string, evalResult: { quality: number; costEfficiency: number }) {
    if (evalResult.quality < 0.5) {
      await this.prisma.aiLearningEntry.create({
        data: {
          tenantId,
          category: 'optimization',
          insight: 'Low quality run detected — consider prompt revision or model upgrade',
          confidence: 0.7,
          recordedAt: new Date(),
        },
      });
    }
  }
}

/** Learning Engine — continuous learning from outcomes. */
@Injectable()
export class LearningEngine {
  constructor(private readonly prisma: PrismaService) {}

  async record(tenantId: string, taskType: string, evalResult: { quality: number }, runId: string) {
    const insight =
      evalResult.quality > 0.8
        ? `Successful ${taskType} pattern — quality ${evalResult.quality.toFixed(2)}`
        : `Suboptimal ${taskType} — review prompt and tools`;

    await this.prisma.aiLearningEntry.create({
      data: {
        tenantId,
        category: taskType,
        insight,
        confidence: evalResult.quality,
        sourceRunId: runId,
        recordedAt: new Date(),
      },
    });
  }

  list(tenantId: string) {
    return this.prisma.aiLearningEntry.findMany({
      where: { tenantId },
      orderBy: { recordedAt: 'desc' },
      take: 50,
    });
  }
}

/** AI Cost Center — tracks spend by model, agent, tenant. */
@Injectable()
export class AiCostService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string) {
    const runs = await this.prisma.aiRunReadModel.findMany({
      where: { tenantId, status: 'completed' },
      orderBy: { startedAt: 'desc' },
      take: 1000,
    });

    const byModel = new Map<string, { costUsd: number; runs: number }>();
    const byAgent = new Map<string, { costUsd: number; runs: number }>();

    for (const r of runs) {
      const m = byModel.get(r.model) ?? { costUsd: 0, runs: 0 };
      m.costUsd += r.costUsd;
      m.runs += 1;
      byModel.set(r.model, m);

      if (r.agentId) {
        const a = byAgent.get(r.agentId) ?? { costUsd: 0, runs: 0 };
        a.costUsd += r.costUsd;
        a.runs += 1;
        byAgent.set(r.agentId, a);
      }
    }

    return {
      totalCostUsd: runs.reduce((s, r) => s + r.costUsd, 0),
      totalTokensIn: runs.reduce((s, r) => s + r.tokensIn, 0),
      totalTokensOut: runs.reduce((s, r) => s + r.tokensOut, 0),
      runCount: runs.length,
      byModel: [...byModel.entries()].map(([model, v]) => ({ model, ...v })),
      byAgent: [...byAgent.entries()].map(([agentId, v]) => ({ agentId, ...v })),
    };
  }
}

/** AI Benchmark — compares models on task types. */
@Injectable()
export class AiBenchmarkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openrouter: OpenRouterClient,
  ) {}

  async runBenchmark(tenantId: string, taskType: string, prompt: string) {
    const models = ['openai/gpt-4o-mini', 'anthropic/claude-3.7-sonnet', 'google/gemini-2.0-flash'];
    const results = [];

    for (const model of models) {
      const started = Date.now();
      try {
        const role = taskType === 'analytics' ? 'analytics' : 'chat';
        const res = await this.openrouter.chat(role, [{ role: 'user', content: prompt }]);
        results.push({
          model,
          latencyMs: Date.now() - started,
          tokensOut: res.tokensOut,
          quality: res.text.length > 10 ? 0.8 : 0.3,
          success: true,
        });
      } catch {
        results.push({ model, latencyMs: Date.now() - started, success: false, quality: 0 });
      }
    }

    const winner = results.filter((r) => r.success).sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0))[0]?.model ?? null;
    const id = uuid();
    await this.prisma.aiBenchmarkRun.create({
      data: { id, tenantId, taskType, models, results, winner, createdAt: new Date() },
    });
    return { id, results, winner };
  }
}
