import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AvitoLiveSyncEngineService } from './avito-live-sync-engine.service';

/** Background scheduler — polls due workers and processes sync queue. */
@Injectable()
export class AvitoLiveSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvitoLiveSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly engine: AvitoLiveSyncEngineService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick().catch((e) =>
        this.logger.error(`Scheduler tick failed: ${e instanceof Error ? e.message : e}`),
      );
    }, 15_000);
    void this.bootstrapReadyAccounts();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async bootstrapReadyAccounts(): Promise<void> {
    const accounts = await this.prisma.avitoAccountDetailReadModel.findMany({
      where: { status: { in: ['ready', 'live'] } },
    });
    for (const a of accounts) {
      await this.engine.ensureWorkers(a.tenantId, a.accountId);
      this.engine.enqueueFullSync(a.tenantId, a.accountId);
    }
  }

  private async tick(): Promise<void> {
    const due = await this.engine.getDueWorkers(10);
    for (const d of due) {
      this.engine.enqueueWorker(d.tenantId, d.accountId, d.worker);
    }
    await this.engine.processQueue(5);
  }

  async updateSchedule(
    tenantId: string,
    accountId: string,
    worker: string,
    intervalSec: number,
    enabled?: boolean,
  ): Promise<void> {
    await this.engine.ensureWorkers(tenantId, accountId);
    await this.prisma.avitoLiveSyncWorkerReadModel.update({
      where: { tenantId_accountId_worker: { tenantId, accountId, worker } },
      data: {
        intervalSec,
        enabled: enabled ?? undefined,
        nextSyncAt: new Date(),
      },
    });
  }
}
