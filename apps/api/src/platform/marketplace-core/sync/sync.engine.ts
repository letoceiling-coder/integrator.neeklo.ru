import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { MarketplaceCode } from '@neeklo/contracts';
import type { MarketplaceContext, SyncChange, SyncResult } from '@neeklo/marketplace-sdk';
import { DomainError } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketplaceRegistryService } from '../registry/marketplace-registry.service';

export type SyncMode = 'full' | 'incremental' | 'reconcile';

export interface SyncRequest {
  tenantId: string;
  accountId: string;
  marketplace: MarketplaceCode;
  mode: SyncMode;
  since?: string;
  correlationId: string;
}

/**
 * Marketplace Synchronization Engine.
 *
 * Pulls changes from provider, classifies operations (create/update/delete/restore/skip/conflict),
 * persists sync job state, and returns structured results for domain event emission.
 */
@Injectable()
export class SyncEngine {
  private readonly logger = new Logger(SyncEngine.name);

  constructor(
    private readonly registry: MarketplaceRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  async run(request: SyncRequest): Promise<{ syncId: string; result: SyncResult }> {
    const syncId = uuid();
    const startedAt = new Date().toISOString();

    await this.prisma.syncJobReadModel.create({
      data: {
        id: syncId,
        tenantId: request.tenantId,
        accountId: request.accountId,
        marketplace: request.marketplace,
        mode: request.mode,
        status: 'running',
        startedAt: new Date(startedAt),
      },
    });

    const ctx: MarketplaceContext = {
      organizationId: request.tenantId,
      accountId: request.accountId,
      marketplaceCode: request.marketplace,
      correlationId: request.correlationId,
    };

    try {
      const provider = this.registry.getProvider(request.marketplace);
      const syncModule = provider.resolve('sync');
      if (!syncModule) {
        throw new DomainError('sync_unavailable', `Sync not supported for ${request.marketplace}`);
      }

      let changes: SyncChange[];
      if (request.mode === 'reconcile') {
        const result = await syncModule.reconcile(ctx);
        await this.completeJob(syncId, result);
        return { syncId, result };
      }

      changes = await syncModule.pull(ctx, request.since);
      const classified = this.classifyChanges(changes);
      const result = await syncModule.push(ctx, classified.actionable);

      const merged: SyncResult = {
        ...result,
        conflicts: [...result.conflicts, ...classified.conflicts],
      };

      await this.completeJob(syncId, merged);
      return { syncId, result: merged };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.prisma.syncJobReadModel.update({
        where: { id: syncId },
        data: { status: 'failed', error: message, completedAt: new Date() },
      });
      throw e;
    }
  }

  private classifyChanges(changes: SyncChange[]): {
    actionable: SyncChange[];
    conflicts: SyncChange[];
  } {
    const actionable: SyncChange[] = [];
    const conflicts: SyncChange[] = [];
    for (const change of changes) {
      if (change.operation === 'conflict' || change.operation === 'skip') {
        conflicts.push(change);
      } else {
        actionable.push(change);
      }
    }
    return { actionable, conflicts };
  }

  private async completeJob(syncId: string, result: SyncResult): Promise<void> {
    await this.prisma.syncJobReadModel.update({
      where: { id: syncId },
      data: {
        status: 'completed',
        completedAt: new Date(result.completedAt),
        stats: {
          created: result.created,
          updated: result.updated,
          deleted: result.deleted,
          restored: result.restored,
          skipped: result.skipped,
          conflicts: result.conflicts.length,
        },
      },
    });
  }
}
