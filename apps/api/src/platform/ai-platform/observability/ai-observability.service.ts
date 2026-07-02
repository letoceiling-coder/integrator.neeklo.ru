import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiEventType, AiTaskType } from '@neeklo/contracts';
import type { AiRunResponseDto } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { ObservabilityService } from '../../marketplace-core/observability/observability.service';
import { AiEventPublisher } from '../events/ai-event.publisher';
import type { GatewayContext } from '../gateway/ai-gateway.service';

/** AI Observability — full pipeline logging. */
@Injectable()
export class AiObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly observability: ObservabilityService,
    private readonly publisher: AiEventPublisher,
  ) {}

  async recordRun(
    ctx: GatewayContext,
    taskType: AiTaskType,
    result: AiRunResponseDto,
    totalLatencyMs: number,
  ): Promise<void> {
    await this.observability.recordSpan({
      tenantId: ctx.tenantId,
      traceId: ctx.correlationId,
      spanId: uuid(),
      operation: `ai.${taskType}`,
      status: 'ok',
      durationMs: totalLatencyMs,
      tags: {
        runId: ctx.runId,
        model: result.model,
        tokensIn: String(result.tokensIn),
        tokensOut: String(result.tokensOut),
        costUsd: String(result.costUsd),
      },
    });

    await this.observability.audit({
      tenantId: ctx.tenantId,
      actorType: 'ai',
      actorId: ctx.runId,
      action: 'ai.run_completed',
      resourceType: 'ai_run',
      resourceId: ctx.runId,
      correlationId: ctx.correlationId,
      details: { taskType, model: result.model, costUsd: result.costUsd },
    });
  }

  async recordFailure(ctx: GatewayContext, taskType: AiTaskType, error: unknown, latencyMs: number): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.prisma.aiRunReadModel.updateMany({
      where: { id: ctx.runId },
      data: { status: 'failed', completedAt: new Date() },
    });
    await this.publisher.publish(ctx.tenantId, `runs:${ctx.runId}`, AiEventType.RunFailed, {
      runId: ctx.runId,
      error: message,
      failedAt: new Date().toISOString(),
    });
    await this.observability.recordSpan({
      tenantId: ctx.tenantId,
      traceId: ctx.correlationId,
      spanId: uuid(),
      operation: `ai.${taskType}`,
      status: 'error',
      durationMs: latencyMs,
      tags: { runId: ctx.runId, error: message.slice(0, 100) },
    });
  }

  async getPipelineHealth(tenantId: string) {
    const recent = await this.prisma.aiRunReadModel.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    const failed = recent.filter((r) => r.status === 'failed').length;
    return {
      recentRuns: recent.length,
      runs24h: recent.length,
      failureRate: recent.length ? failed / recent.length : 0,
      errorRate: recent.length ? failed / recent.length : 0,
      avgLatencyMs: recent.length ? recent.reduce((s, r) => s + (r.latencyMs ?? 0), 0) / recent.length : 0,
      totalCostUsd: recent.reduce((s, r) => s + r.costUsd, 0),
      toolInvocations: recent.reduce((s, r) => s + (Array.isArray(r.toolCalls) ? (r.toolCalls as unknown[]).length : 0), 0),
    };
  }
}
