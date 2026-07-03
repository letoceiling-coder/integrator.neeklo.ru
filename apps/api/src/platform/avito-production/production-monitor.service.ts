import { Injectable } from '@nestjs/common';
import type { AvitoProductionMonitorDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductionMonitorService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonitor(tenantId: string, accountId: string): Promise<AvitoProductionMonitorDto> {
    const since = new Date(Date.now() - 86_400_000);

    const [logs, workers, webhookLogs] = await Promise.all([
      this.prisma.avitoLiveRequestLogReadModel.findMany({
        where: { tenantId, accountId, occurredAt: { gte: since } },
        take: 500,
      }),
      this.prisma.avitoLiveSyncWorkerReadModel.findMany({ where: { tenantId, accountId } }),
      this.prisma.avitoLiveRequestLogReadModel.count({
        where: { tenantId, accountId, status: { gte: 400 }, occurredAt: { gte: since } },
      }),
    ]);

    const errors24h = logs.filter((l) => l.status >= 400).length;
    const rateLimit429 = logs.filter((l) => l.status === 429).length;
    const avgLatencyMs = logs.length ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / logs.length) : 0;
    const retries24h = logs.filter((l) => l.retryCount > 0).length;

    const lastSync = workers.reduce((max, w) => {
      const t = w.lastSyncAt?.getTime() ?? 0;
      return t > max ? t : max;
    }, 0);
    const syncLagSec = lastSync ? Math.round((Date.now() - lastSync) / 1000) : null;

    const storageOk = Boolean(process.env.S3_BUCKET);

    return {
      errors24h,
      avgLatencyMs,
      retries24h,
      rateLimit429,
      webhookFailures24h: webhookLogs,
      syncLagSec,
      queueDepth: workers.filter((w) => w.lastStatus === 'pending' || w.lastStatus === 'running').length,
      storageOk,
      workers: workers.map((w) => ({
        name: w.worker,
        status: w.lastStatus,
        lastRunAt: w.lastSyncAt?.toISOString() ?? null,
      })),
      checkedAt: new Date().toISOString(),
    };
  }
}
