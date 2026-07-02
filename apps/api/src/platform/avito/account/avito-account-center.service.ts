import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AvitoEventType, MarketplaceCode } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { AvitoEventPublisher } from '../events/avito-event.publisher';

/** Avito Account Center — multi-account status, sync history, limits. */
@Injectable()
export class AvitoAccountCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: AvitoEventPublisher,
  ) {}

  async getAccountCenter(tenantId: string) {
    const accounts = await this.prisma.accountReadModel.findMany({
      where: { organizationId: tenantId, marketplace: MarketplaceCode.AVITO },
      orderBy: { createdAt: 'desc' },
    });

    const details = await this.prisma.avitoAccountDetailReadModel.findMany({ where: { tenantId } });
    const detailMap = new Map(details.map((d) => [d.accountId, d]));

    return accounts.map((a) => {
      const d = detailMap.get(a.id);
      return {
        id: a.id,
        tenantId,
        marketplace: a.marketplace,
        displayName: a.displayName,
        externalAccountId: d?.externalAccountId ?? a.externalAccountId,
        status: d?.status ?? (a.status === 'active' ? 'authorized' : a.status),
        lastSyncAt: d?.lastSyncAt?.toISOString() ?? null,
        lastSyncStatus: d?.lastSyncStatus ?? null,
        lastSyncError: d?.lastSyncError ?? null,
        balanceRub: d?.balanceRub ?? null,
        dailyMessageLimit: d?.dailyMessageLimit ?? 10_000,
        permissions: d?.permissions ?? ['messaging', 'statistics'],
        enabled: a.status !== 'disabled',
        syncHistory: (d?.syncHistory as { at: string; status: string; items?: number }[]) ?? [],
      };
    });
  }

  async recordSyncStart(tenantId: string, accountId: string, ctx: AppendContext) {
    const syncJobId = uuid();
    await this.upsertDetail(tenantId, accountId, { lastSyncStatus: 'running' });
    await this.publisher.publish(tenantId, `account:${accountId}`, AvitoEventType.AccountSyncStarted, {
      accountId,
      syncJobId,
      startedAt: new Date().toISOString(),
    }, ctx);
    return { syncJobId };
  }

  async recordSyncComplete(
    tenantId: string,
    accountId: string,
    syncJobId: string,
    itemsSynced: number,
    ctx: AppendContext,
  ) {
    const now = new Date();
    const detail = await this.upsertDetail(tenantId, accountId, {
      lastSyncAt: now,
      lastSyncStatus: 'completed',
      lastSyncError: null,
    });
    const history = [...((detail.syncHistory as object[]) ?? []), { at: now.toISOString(), status: 'completed', items: itemsSynced }];
    await this.prisma.avitoAccountDetailReadModel.update({
      where: { tenantId_accountId: { tenantId, accountId } },
      data: { syncHistory: history.slice(-20), updatedAt: now },
    });
    await this.publisher.publish(tenantId, `account:${accountId}`, AvitoEventType.AccountSyncCompleted, {
      accountId,
      syncJobId,
      itemsSynced,
      completedAt: now.toISOString(),
    }, ctx);
  }

  async recordSyncFailed(tenantId: string, accountId: string, syncJobId: string, error: string, ctx: AppendContext) {
    await this.upsertDetail(tenantId, accountId, {
      lastSyncStatus: 'failed',
      lastSyncError: error,
    });
    await this.publisher.publish(tenantId, `account:${accountId}`, AvitoEventType.AccountSyncFailed, {
      accountId,
      syncJobId,
      error,
      failedAt: new Date().toISOString(),
    }, ctx);
  }

  private async upsertDetail(tenantId: string, accountId: string, patch: Record<string, unknown>) {
    return this.prisma.avitoAccountDetailReadModel.upsert({
      where: { tenantId_accountId: { tenantId, accountId } },
      create: {
        id: uuid(),
        tenantId,
        accountId,
        status: 'pending',
        permissions: ['messaging', 'statistics'],
        syncHistory: [],
        updatedAt: new Date(),
        ...patch,
      },
      update: { ...patch, updatedAt: new Date() },
    });
  }
}
