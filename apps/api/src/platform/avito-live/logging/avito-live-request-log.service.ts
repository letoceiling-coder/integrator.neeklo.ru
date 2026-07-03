import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';

export interface LiveRequestLogInput {
  tenantId: string;
  accountId?: string;
  correlationId: string;
  worker?: string;
  method: string;
  url: string;
  status: number;
  latencyMs: number;
  retryCount?: number;
  rateLimitRemaining?: number | null;
  responsePreview?: string;
  headers?: Record<string, string>;
}

@Injectable()
export class AvitoLiveRequestLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: LiveRequestLogInput): Promise<string> {
    const requestId = uuid();
    await this.prisma.avitoLiveRequestLogReadModel.create({
      data: {
        tenantId: input.tenantId,
        accountId: input.accountId ?? null,
        requestId,
        correlationId: input.correlationId,
        worker: input.worker ?? null,
        method: input.method,
        url: input.url,
        status: input.status,
        latencyMs: input.latencyMs,
        retryCount: input.retryCount ?? 0,
        rateLimitRemaining: input.rateLimitRemaining ?? null,
        responsePreview: input.responsePreview?.slice(0, 1000) ?? null,
        headers: input.headers ?? {},
        occurredAt: new Date(),
      },
    });
    return requestId;
  }

  async listRecent(tenantId: string, limit = 50) {
    return this.prisma.avitoLiveRequestLogReadModel.findMany({
      where: { tenantId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }

  async usageStats(tenantId: string, sinceMs: number) {
    const since = new Date(Date.now() - sinceMs);
    const rows = await this.prisma.avitoLiveRequestLogReadModel.findMany({
      where: { tenantId, occurredAt: { gte: since } },
    });
    const errors429 = rows.filter((r) => r.status === 429).length;
    const avgLatency =
      rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length) : 0;
    const lastRate = rows.find((r) => r.rateLimitRemaining != null)?.rateLimitRemaining ?? null;

    const byUrl = new Map<string, { count: number; latency: number; method: string }>();
    for (const r of rows) {
      const key = `${r.method} ${r.url}`;
      const cur = byUrl.get(key) ?? { count: 0, latency: 0, method: r.method };
      cur.count++;
      cur.latency += r.latencyMs;
      byUrl.set(key, cur);
    }
    const heaviest = [...byUrl.entries()]
      .map(([url, v]) => ({
        url: url.split(' ').slice(1).join(' '),
        method: v.method,
        count: v.count,
        avgLatencyMs: Math.round(v.latency / v.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recentErrors = rows
      .filter((r) => r.status >= 400)
      .slice(0, 20)
      .map((r) => ({
        at: r.occurredAt.toISOString(),
        status: r.status,
        url: r.url,
        message: r.responsePreview ?? `HTTP ${r.status}`,
      }));

    return {
      requestsLastHour: rows.length,
      errors429,
      avgLatencyMs: avgLatency,
      rateLimitRemaining: lastRate,
      heaviestRequests: heaviest,
      recentErrors,
    };
  }
}
