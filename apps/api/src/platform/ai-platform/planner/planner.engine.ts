import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiEventType } from '@neeklo/contracts';
import type { AiRunRequestDto } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AiEventPublisher } from '../events/ai-event.publisher';
import type { GatewayContext } from '../gateway/ai-gateway.service';

export interface PlanStep {
  stepIndex: number;
  kind: 'reason' | 'tool' | 'model' | 'validate';
  label: string;
  toolName?: string;
  input?: Record<string, unknown>;
  dependsOn: number[];
}

export interface ExecutionPlan {
  planId: string;
  steps: PlanStep[];
}

/** Planner Engine — decomposes tasks into DAG steps persisted as jobs. */
@Injectable()
export class PlannerEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: AiEventPublisher,
  ) {}

  async createPlan(ctx: GatewayContext, request: AiRunRequestDto): Promise<ExecutionPlan> {
    const planId = uuid();
    const steps: PlanStep[] = [
      { stepIndex: 0, kind: 'reason', label: 'Gather context', dependsOn: [] },
    ];

    if (request.toolNames?.length) {
      for (let i = 0; i < request.toolNames.length; i++) {
        steps.push({
          stepIndex: i + 1,
          kind: 'tool',
          label: `Invoke ${request.toolNames[i]}`,
          toolName: request.toolNames[i],
          dependsOn: [0],
        });
      }
    }

    steps.push({
      stepIndex: steps.length,
      kind: 'model',
      label: 'Generate response',
      dependsOn: steps.length > 1 ? [steps.length - 1] : [0],
    });

    steps.push({
      stepIndex: steps.length,
      kind: 'validate',
      label: 'Validate output',
      dependsOn: [steps.length - 1],
    });

    const limited = steps.slice(0, request.maxSteps + 2);

    await this.prisma.aiPlanReadModel.create({
      data: {
        id: planId,
        tenantId: ctx.tenantId,
        runId: ctx.runId,
        dag: { steps: limited },
        status: 'ready',
        createdAt: new Date(),
        steps: {
          create: limited.map((s) => ({
            id: uuid(),
            stepIndex: s.stepIndex,
            kind: s.kind,
            label: s.label,
            dependsOn: s.dependsOn,
            status: 'pending',
          })),
        },
      },
    });

    await this.publisher.publish(ctx.tenantId, `plans:${planId}`, AiEventType.PlanCreated, {
      planId,
      runId: ctx.runId,
      stepCount: limited.length,
      dag: { steps: limited.map((s) => s.label) },
      createdAt: new Date().toISOString(),
    });

    return { planId, steps: limited };
  }
}
