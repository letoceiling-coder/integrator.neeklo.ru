import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  tenantId: string;
  actorType: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  correlationId: string;
  details?: Record<string, unknown>;
}

export interface TraceSpan {
  tenantId?: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  status: 'ok' | 'error';
  durationMs: number;
  tags?: Record<string, string>;
}

/**
 * Observability layer: audit log, distributed tracing spans, health metrics.
 */
@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async audit(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        correlationId: entry.correlationId,
        details: entry.details ?? {},
        occurredAt: new Date(),
      },
    });
  }

  async recordSpan(span: TraceSpan): Promise<void> {
    await this.prisma.telemetrySpan.create({
      data: {
        tenantId: span.tenantId ?? null,
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId ?? null,
        operation: span.operation,
        status: span.status,
        durationMs: span.durationMs,
        tags: span.tags ?? {},
        startedAt: new Date(Date.now() - span.durationMs),
      },
    });
  }

  /** Wrap an async operation with tracing + audit. */
  async trace<T>(
    operation: string,
    fn: () => Promise<T>,
    meta: { tenantId?: string; correlationId: string; audit?: AuditEntry },
  ): Promise<T> {
    const traceId = uuid();
    const spanId = uuid();
    const started = Date.now();
    try {
      const result = await fn();
      await this.recordSpan({
        tenantId: meta.tenantId,
        traceId,
        spanId,
        operation,
        status: 'ok',
        durationMs: Date.now() - started,
      });
      if (meta.audit) await this.audit(meta.audit);
      return result;
    } catch (e) {
      await this.recordSpan({
        tenantId: meta.tenantId,
        traceId,
        spanId,
        operation,
        status: 'error',
        durationMs: Date.now() - started,
        tags: { error: e instanceof Error ? e.message : String(e) },
      });
      throw e;
    }
  }

  async getHealthSummary(): Promise<{
    auditLogCount: number;
    spanCount24h: number;
    errorRate24h: number;
  }> {
    const since = new Date(Date.now() - 86_400_000);
    const [auditLogCount, spans, errors] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.telemetrySpan.count({ where: { startedAt: { gte: since } } }),
      this.prisma.telemetrySpan.count({ where: { startedAt: { gte: since }, status: 'error' } }),
    ]);
    return {
      auditLogCount,
      spanCount24h: spans,
      errorRate24h: spans > 0 ? errors / spans : 0,
    };
  }
}
