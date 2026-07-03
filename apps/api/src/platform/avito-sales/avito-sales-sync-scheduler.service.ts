import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvitoCrmBridgeService } from './avito-crm-bridge.service';

/** Syncs Avito messenger snapshots → CRM leads/conversations. */
@Injectable()
export class AvitoSalesSyncSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvitoSalesSyncSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bridge: AvitoCrmBridgeService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick().catch((e) => this.logger.error(e)), 120_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    const accounts = await this.prisma.avitoAccountDetailReadModel.findMany({
      where: { status: { in: ['ready', 'live'] } },
    });
    for (const a of accounts) {
      await this.bridge.syncFromMessengerSnapshot(a.tenantId, a.accountId);
    }
  }
}
