import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { ObservabilityService } from '../../marketplace-core/observability/observability.service';

/**
 * Intelligence-layer observability: business metrics, pipeline latency, audit hooks.
 */
@Injectable()
export class IntelligenceObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly observability: ObservabilityService,
  ) {}

  async recordBusinessMetric(
    tenantId: string,
    metricName: string,
    value: number,
    tags: Record<string, string> = {},
  ): Promise<void> {
    await this.prisma.businessMetricSnapshot.create({
      data: { tenantId, metricName, value, tags, recordedAt: new Date() },
    });
  }

  async recordPipelineLatency(
    operation: string,
    durationMs: number,
    meta: { tenantId: string; eventType?: string; traceId?: string; status?: string },
  ): Promise<void> {
    await this.observability.recordSpan({
      tenantId: meta.tenantId,
      traceId: meta.traceId ?? uuid(),
      spanId: uuid(),
      operation: `intelligence.${operation}`,
      status: meta.status === 'error' ? 'error' : 'ok',
      durationMs,
      tags: {
        eventType: meta.eventType ?? '',
        pipeline: 'intelligence',
      },
    });
  }

  async getPipelineHealth() {
    const checkpoint = await this.prisma.intelligencePipelineCheckpoint.findUnique({
      where: { pipeline: 'intelligence-pipeline' },
    });
    const recentMetrics = await this.prisma.businessMetricSnapshot.findMany({
      orderBy: { recordedAt: 'desc' },
      take: 20,
    });
    return {
      pipeline: 'intelligence-pipeline',
      lastPosition: checkpoint?.position?.toString() ?? '0',
      lastUpdatedAt: checkpoint?.updatedAt?.toISOString() ?? null,
      recentBusinessMetrics: recentMetrics,
    };
  }
}
