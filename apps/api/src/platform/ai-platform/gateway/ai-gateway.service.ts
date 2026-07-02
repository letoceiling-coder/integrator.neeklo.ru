import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiTaskType } from '@neeklo/contracts';
import type { AiRunRequestDto } from '@neeklo/contracts';
import { DomainError } from '@neeklo/kernel';
import { RequestContextService } from '../../context/request-context';
import { AiOrchestratorService } from '../orchestrator/ai-orchestrator.service';
import { AiObservabilityService } from '../observability/ai-observability.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface GatewayContext {
  tenantId: string;
  actorId: string | null;
  correlationId: string;
  runId: string;
}

/**
 * AI Gateway — single entry point for all AI tasks.
 * Handles auth context, limits, routing metadata, cost tracking, and logging.
 */
@Injectable()
export class AiGatewayService {
  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly observability: AiObservabilityService,
    private readonly ctx: RequestContextService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(request: AiRunRequestDto) {
    const rc = this.ctx.require();
    return this.executeWithContext(request, {
      tenantId: rc.tenantId,
      actorId: rc.actor.id,
      correlationId: rc.correlationId,
      runId: uuid(),
    });
  }

  /** Programmatic entry (workflows, commerce agent) with explicit tenant context. */
  async executeWithContext(request: AiRunRequestDto, gatewayCtx: GatewayContext) {
    const dailyRuns = await this.prisma.aiRunReadModel.count({
      where: {
        tenantId: gatewayCtx.tenantId,
        startedAt: { gte: new Date(Date.now() - 86_400_000) },
      },
    });
    if (dailyRuns > 10_000) {
      throw new DomainError('ai_rate_limit', 'Daily AI run limit exceeded for tenant');
    }

    const started = Date.now();
    try {
      const result = await this.orchestrator.run(request, gatewayCtx);
      await this.observability.recordRun(gatewayCtx, request.taskType as AiTaskType, result, Date.now() - started);
      return result;
    } catch (e) {
      await this.observability.recordFailure(gatewayCtx, request.taskType as AiTaskType, e, Date.now() - started);
      throw e;
    }
  }
}
