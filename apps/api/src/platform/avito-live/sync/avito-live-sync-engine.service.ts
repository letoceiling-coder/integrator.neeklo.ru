import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';
import {
  AvitoEventType,
  AvitoSyncWorker,
  MarketplaceCode,
} from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { DomainError } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { AvitoClient } from '../../adapters/avito/avito.client';
import { AvitoEventPublisher } from '../../avito/events/avito-event.publisher';
import { OFFICIAL_AVITO_WORKERS } from '../catalog/avito-official-endpoints';
import { AvitoLiveRequestLogService } from '../logging/avito-live-request-log.service';

export interface WorkerRunResult {
  worker: string;
  status: 'completed' | 'failed' | 'unavailable' | 'limited';
  latencyMs: number;
  sourceCount: number;
  updatedCount: number;
  deletedCount: number;
  error: string | null;
  limitation: string | null;
}

@Injectable()
export class AvitoLiveSyncEngineService {
  private readonly logger = new Logger(AvitoLiveSyncEngineService.name);
  private readonly queue: { tenantId: string; accountId: string; worker?: string; correlationId: string }[] = [];
  private activeWorker: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly avito: AvitoClient,
    private readonly publisher: AvitoEventPublisher,
    private readonly requestLog: AvitoLiveRequestLogService,
  ) {}

  getQueueDepth(): number {
    return this.queue.length;
  }

  getActiveWorker(): string | null {
    return this.activeWorker;
  }

  async ensureWorkers(tenantId: string, accountId: string): Promise<void> {
    for (const def of OFFICIAL_AVITO_WORKERS) {
      await this.prisma.avitoLiveSyncWorkerReadModel.upsert({
        where: { tenantId_accountId_worker: { tenantId, accountId, worker: def.worker } },
        create: {
          tenantId,
          accountId,
          worker: def.worker,
          label: def.label,
          officialApi: def.officialApi,
          intervalSec: def.defaultIntervalSec,
          enabled: def.worker !== AvitoSyncWorker.Delivery && def.worker !== AvitoSyncWorker.Jobs,
          limitation: def.limitation,
          nextSyncAt: new Date(),
        },
        update: { label: def.label, officialApi: def.officialApi, limitation: def.limitation },
      });
    }
  }

  enqueueFullSync(tenantId: string, accountId: string, correlationId?: string): void {
    this.queue.push({
      tenantId,
      accountId,
      correlationId: correlationId ?? uuid(),
    });
  }

  enqueueWorker(tenantId: string, accountId: string, worker: string, correlationId?: string): void {
    this.queue.push({
      tenantId,
      accountId,
      worker,
      correlationId: correlationId ?? uuid(),
    });
  }

  async processQueue(maxJobs = 5): Promise<number> {
    let processed = 0;
    while (processed < maxJobs && this.queue.length > 0) {
      const job = this.queue.shift()!;
      if (job.worker) {
        await this.runWorker(job.tenantId, job.accountId, job.worker, job.correlationId);
      } else {
        await this.runFullSync(job.tenantId, job.accountId, job.correlationId);
      }
      processed++;
    }
    return processed;
  }

  async runFullSync(tenantId: string, accountId: string, correlationId?: string): Promise<WorkerRunResult[]> {
    const corr = correlationId ?? uuid();
    await this.ensureWorkers(tenantId, accountId);
    const ctx: AppendContext = { tenantId, actor: { type: 'system', id: 'avito-live-sync' }, correlationId: corr };
    const results: WorkerRunResult[] = [];

    const order = [
      AvitoSyncWorker.Profile,
      AvitoSyncWorker.Items,
      AvitoSyncWorker.Categories,
      AvitoSyncWorker.Tariff,
      AvitoSyncWorker.Messenger,
      AvitoSyncWorker.Stats,
      AvitoSyncWorker.Promotion,
      AvitoSyncWorker.Autoload,
      AvitoSyncWorker.Hierarchy,
      AvitoSyncWorker.Phones,
      AvitoSyncWorker.Employees,
      AvitoSyncWorker.Ratings,
      AvitoSyncWorker.Reviews,
      AvitoSyncWorker.Stock,
      AvitoSyncWorker.CallTracking,
      AvitoSyncWorker.ApiCatalog,
    ];

    for (const worker of order) {
      const row = await this.prisma.avitoLiveSyncWorkerReadModel.findUnique({
        where: { tenantId_accountId_worker: { tenantId, accountId, worker } },
      });
      if (row && !row.enabled) continue;
      results.push(await this.runWorker(tenantId, accountId, worker, corr, ctx));
    }

    await this.prisma.avitoAccountDetailReadModel.upsert({
      where: { tenantId_accountId: { tenantId, accountId } },
      create: {
        id: uuid(),
        tenantId,
        accountId,
        status: 'live',
        permissions: ['messaging', 'statistics', 'items:info'],
        syncHistory: [],
        updatedAt: new Date(),
        lastSyncAt: new Date(),
        lastSyncStatus: 'completed',
      },
      update: {
        status: 'live',
        lastSyncAt: new Date(),
        lastSyncStatus: 'completed',
        lastSyncError: null,
        updatedAt: new Date(),
      },
    });

    return results;
  }

  async runWorker(
    tenantId: string,
    accountId: string,
    worker: string,
    correlationId?: string,
    ctx?: AppendContext,
  ): Promise<WorkerRunResult> {
    const corr = correlationId ?? uuid();
    const appendCtx = ctx ?? { tenantId, actor: { type: 'system', id: 'avito-live-sync' }, correlationId: corr };
    this.activeWorker = worker;
    const started = Date.now();

    await this.prisma.avitoLiveSyncWorkerReadModel.updateMany({
      where: { tenantId, accountId, worker },
      data: { lastStatus: 'running' },
    });

    try {
      const result = await this.executeWorker(tenantId, accountId, worker, corr);
      const now = new Date();
      const row = await this.prisma.avitoLiveSyncWorkerReadModel.findUnique({
        where: { tenantId_accountId_worker: { tenantId, accountId, worker } },
      });
      const intervalSec = row?.intervalSec ?? 300;

      await this.prisma.avitoLiveSyncWorkerReadModel.update({
        where: { tenantId_accountId_worker: { tenantId, accountId, worker } },
        data: {
          lastStatus: result.status,
          lastSyncAt: now,
          nextSyncAt: new Date(now.getTime() + intervalSec * 1000),
          lastLatencyMs: result.latencyMs,
          lastError: result.error,
          sourceCount: result.sourceCount,
          updatedCount: result.updatedCount,
          deletedCount: result.deletedCount,
          version: { increment: 1 },
          retryCount: result.status === 'failed' ? { increment: 1 } : 0,
        },
      });

      await this.publisher.publish(
        tenantId,
        `live:${accountId}`,
        AvitoEventType.SyncWorkerCompleted,
        {
          accountId,
          worker,
          status: result.status,
          latencyMs: result.latencyMs,
          sourceCount: result.sourceCount,
          updatedCount: result.updatedCount,
          completedAt: now.toISOString(),
        },
        appendCtx,
      );

      await this.publishDomainEvent(tenantId, accountId, worker, result, appendCtx);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.prisma.avitoLiveSyncWorkerReadModel.updateMany({
        where: { tenantId, accountId, worker },
        data: { lastStatus: 'failed', lastError: message, retryCount: { increment: 1 } },
      });
      return {
        worker,
        status: 'failed',
        latencyMs: Date.now() - started,
        sourceCount: 0,
        updatedCount: 0,
        deletedCount: 0,
        error: message,
        limitation: null,
      };
    } finally {
      this.activeWorker = null;
    }
  }

  private async executeWorker(
    tenantId: string,
    accountId: string,
    worker: string,
    correlationId: string,
  ): Promise<WorkerRunResult> {
    const started = Date.now();
    const def = OFFICIAL_AVITO_WORKERS.find((w) => w.worker === worker);
    const limitation = def?.limitation ?? null;

    if (worker === AvitoSyncWorker.Delivery || worker === AvitoSyncWorker.Jobs) {
      return {
        worker,
        status: 'unavailable',
        latencyMs: Date.now() - started,
        sourceCount: 0,
        updatedCount: 0,
        deletedCount: 0,
        error: null,
        limitation,
      };
    }

    try {
      switch (worker) {
        case AvitoSyncWorker.Profile:
          return await this.syncProfile(tenantId, accountId, worker, correlationId, started);
        case AvitoSyncWorker.Items:
          return await this.syncItems(tenantId, accountId, worker, correlationId, started);
        case AvitoSyncWorker.Categories:
          return await this.syncCategories(tenantId, accountId, worker, correlationId, started, limitation);
        case AvitoSyncWorker.Tariff:
          return await this.syncTariff(tenantId, accountId, worker, correlationId, started);
        case AvitoSyncWorker.Messenger:
          return await this.syncMessenger(tenantId, accountId, worker, correlationId, started);
        case AvitoSyncWorker.Stats:
          return await this.syncStats(tenantId, accountId, worker, correlationId, started, limitation);
        case AvitoSyncWorker.Promotion:
          return await this.syncPromotion(tenantId, accountId, worker, correlationId, started, limitation);
        case AvitoSyncWorker.Autoload:
          return await this.syncAutoload(tenantId, accountId, worker, correlationId, started, limitation);
        case AvitoSyncWorker.Hierarchy:
          return await this.syncHierarchy(tenantId, accountId, worker, correlationId, started, limitation);
        case AvitoSyncWorker.Phones:
          return await this.syncPhones(tenantId, accountId, worker, correlationId, started, limitation);
        case AvitoSyncWorker.Employees:
          return await this.syncEmployees(tenantId, accountId, worker, correlationId, started, limitation);
        case AvitoSyncWorker.Ratings:
          return await this.syncRatings(tenantId, accountId, worker, correlationId, started);
        case AvitoSyncWorker.Reviews:
          return await this.syncReviews(tenantId, accountId, worker, correlationId, started);
        case AvitoSyncWorker.Stock:
          return await this.syncStock(tenantId, accountId, worker, correlationId, started, limitation);
        case AvitoSyncWorker.CallTracking:
          return await this.syncCallTracking(tenantId, accountId, worker, correlationId, started, limitation);
        case AvitoSyncWorker.ApiCatalog:
          return await this.syncApiCatalog(tenantId, accountId, worker, started);
        default:
          return {
            worker,
            status: 'unavailable',
            latencyMs: Date.now() - started,
            sourceCount: 0,
            updatedCount: 0,
            deletedCount: 0,
            error: 'Unknown worker',
            limitation,
          };
      }
    } catch (e) {
      if (e instanceof DomainError) {
        const status = e.code === 'avito_request_failed' ? 'failed' : 'unavailable';
        return {
          worker,
          status,
          latencyMs: Date.now() - started,
          sourceCount: 0,
          updatedCount: 0,
          deletedCount: 0,
          error: e.message,
          limitation,
        };
      }
      throw e;
    }
  }

  private async selfId(tenantId: string, accountId: string): Promise<number> {
    const snap = await this.prisma.avitoLiveSnapshotReadModel.findUnique({
      where: { tenantId_accountId_domain: { tenantId, accountId, domain: 'profile' } },
    });
    if (snap?.payload && typeof snap.payload === 'object' && 'id' in (snap.payload as object)) {
      return Number((snap.payload as { id: number }).id);
    }
    const profile = await this.avito.request<{ id: number }>(tenantId, accountId, 'GET', '/core/v1/accounts/self');
    return profile.id;
  }

  private async syncProfile(
    tenantId: string,
    accountId: string,
    worker: string,
    correlationId: string,
    started: number,
  ): Promise<WorkerRunResult> {
    const t0 = Date.now();
    const profile = await this.avito.request<Record<string, unknown>>(
      tenantId,
      accountId,
      'GET',
      '/core/v1/accounts/self',
    );
    await this.logRequest(tenantId, accountId, worker, correlationId, 'GET', '/core/v1/accounts/self', 200, Date.now() - t0);

    let balance: unknown = null;
    try {
      balance = await this.avito.request(tenantId, accountId, 'GET', `/core/v1/accounts/${profile.id}/balance/`);
    } catch {
      /* balance may require scope */
    }

    await this.saveSnapshot(tenantId, accountId, 'profile', { ...profile, balance }, 1);
    await this.prisma.accountReadModel.updateMany({
      where: { id: accountId, organizationId: tenantId },
      data: {
        displayName: String(profile.name ?? `Avito #${profile.id}`),
        externalAccountId: String(profile.id),
      },
    });

    return {
      worker,
      status: 'completed',
      latencyMs: Date.now() - started,
      sourceCount: 1,
      updatedCount: 1,
      deletedCount: 0,
      error: null,
      limitation: null,
    };
  }

  private async syncItems(
    tenantId: string,
    accountId: string,
    worker: string,
    correlationId: string,
    started: number,
  ): Promise<WorkerRunResult> {
    const userId = await this.selfId(tenantId, accountId);
    const t0 = Date.now();
    const items = await this.avito.request<{ resources?: Record<string, unknown>[]; items?: Record<string, unknown>[] }>(
      tenantId,
      accountId,
      'GET',
      '/core/v1/items',
      { query: { user_id: userId } },
    );
    await this.logRequest(tenantId, accountId, worker, correlationId, 'GET', '/core/v1/items', 200, Date.now() - t0);

    const list = items.resources ?? items.items ?? [];
    let updated = 0;
    for (const item of list) {
      const externalId = String(item.id ?? item.item_id ?? '');
      if (!externalId) continue;
      const title = String(item.title ?? item.name ?? 'Avito Item');
      const status = String(item.status ?? 'active');
      const price = Number(item.price ?? item.price_rub ?? 0);

      const existing = await this.prisma.adReadModel.findFirst({
        where: { tenantId, marketplace: MarketplaceCode.AVITO, externalId },
      });
      if (existing) {
        await this.prisma.adReadModel.update({
          where: { id: existing.id },
          data: { title, status, priceAmount: Math.round(price), updatedAt: new Date() },
        });
      } else {
        await this.prisma.adReadModel.create({
          data: {
            id: uuid(),
            tenantId,
            marketplace: MarketplaceCode.AVITO,
            externalId,
            status,
            title,
            categoryId: String(item.category_id ?? 'unknown'),
            regionId: String(item.region_id ?? 'unknown'),
            cityId: String(item.city_id ?? 'unknown'),
            priceAmount: Math.round(price),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
      updated++;
    }

    await this.saveSnapshot(tenantId, accountId, 'items', { count: list.length, sample: list.slice(0, 5) }, list.length);

    return {
      worker,
      status: 'completed',
      latencyMs: Date.now() - started,
      sourceCount: list.length,
      updatedCount: updated,
      deletedCount: 0,
      error: null,
      limitation: null,
    };
  }

  private async syncCategories(
    tenantId: string,
    accountId: string,
    worker: string,
    correlationId: string,
    started: number,
    limitation: string | null,
  ): Promise<WorkerRunResult> {
    try {
      const t0 = Date.now();
      const tree = await this.avito.request<unknown>(tenantId, accountId, 'GET', '/autoload/v1/user-docs/tree');
      await this.logRequest(tenantId, accountId, worker, correlationId, 'GET', '/autoload/v1/user-docs/tree', 200, Date.now() - t0);
      const count = Array.isArray(tree) ? tree.length : 1;
      await this.saveSnapshot(tenantId, accountId, 'categories', tree as object, count);
      return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: count, updatedCount: count, deletedCount: 0, error: null, limitation };
    } catch (e) {
      return { worker, status: 'limited', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation };
    }
  }

  private async syncTariff(tenantId: string, accountId: string, worker: string, correlationId: string, started: number): Promise<WorkerRunResult> {
    try {
      const tariff = await this.avito.request<unknown>(tenantId, accountId, 'GET', '/tariff/info/1');
      await this.saveSnapshot(tenantId, accountId, 'tariff', tariff as object, 1);
      return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: 1, updatedCount: 1, deletedCount: 0, error: null, limitation: null };
    } catch (e) {
      return { worker, status: 'failed', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation: null };
    }
  }

  private async syncMessenger(tenantId: string, accountId: string, worker: string, correlationId: string, started: number): Promise<WorkerRunResult> {
    const userId = await this.selfId(tenantId, accountId);
    const chats = await this.avito.request<{ chats?: unknown[]; result?: { chats?: unknown[] } }>(
      tenantId,
      accountId,
      'GET',
      `/messenger/v2/accounts/${userId}/chats`,
      { query: { limit: 50 } },
    );
    const list = chats.chats ?? chats.result?.chats ?? [];
    await this.saveSnapshot(tenantId, accountId, 'messenger', { chats: list.slice(0, 20) }, list.length);
    return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: list.length, updatedCount: list.length, deletedCount: 0, error: null, limitation: null };
  }

  private async syncStats(tenantId: string, accountId: string, worker: string, correlationId: string, started: number, limitation: string | null): Promise<WorkerRunResult> {
    const userId = await this.selfId(tenantId, accountId);
    const itemsSnap = await this.prisma.avitoLiveSnapshotReadModel.findUnique({
      where: { tenantId_accountId_domain: { tenantId, accountId, domain: 'items' } },
    });
    const ads = await this.prisma.adReadModel.findMany({
      where: { tenantId, marketplace: MarketplaceCode.AVITO },
      take: 20,
    });
    const itemIds = ads.map((a) => Number(a.externalId)).filter((n) => !Number.isNaN(n));
    if (!itemIds.length) {
      return { worker, status: 'limited', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: 'No item IDs for stats', limitation };
    }
    const today = new Date().toISOString().slice(0, 10);
    const stats = await this.avito.request<unknown>(tenantId, accountId, 'POST', `/stats/v1/accounts/${userId}/items`, {
      body: { dateFrom: today, dateTo: today, fields: ['uniqViews', 'uniqContacts'], itemIds, periodGrouping: 'day' },
    });
    await this.saveSnapshot(tenantId, accountId, 'stats', stats as object, itemIds.length);
    return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: itemIds.length, updatedCount: itemIds.length, deletedCount: 0, error: null, limitation };
  }

  private async syncPromotion(tenantId: string, accountId: string, worker: string, correlationId: string, started: number, limitation: string | null): Promise<WorkerRunResult> {
    try {
      const dict = await this.avito.request<unknown>(tenantId, accountId, 'POST', '/promotion/v1/items/services/dict', { body: {} });
      await this.saveSnapshot(tenantId, accountId, 'promotion', dict as object, 1);
      return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: 1, updatedCount: 1, deletedCount: 0, error: null, limitation };
    } catch (e) {
      return { worker, status: 'limited', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation };
    }
  }

  private async syncAutoload(tenantId: string, accountId: string, worker: string, correlationId: string, started: number, limitation: string | null): Promise<WorkerRunResult> {
    let profile: unknown = null;
    let uploads: unknown = null;
    try {
      profile = await this.avito.request(tenantId, accountId, 'GET', '/autoload/v2/profile');
    } catch (e) {
      return { worker, status: 'limited', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation };
    }
    try {
      uploads = await this.avito.request(tenantId, accountId, 'GET', '/autoload/v4/uploads');
    } catch {
      /* uploads optional */
    }
    const uploadCount = Array.isArray(uploads) ? uploads.length : uploads ? 1 : 0;
    await this.saveSnapshot(tenantId, accountId, 'autoload', { profile, uploads }, uploadCount);
    return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: uploadCount + 1, updatedCount: uploadCount + 1, deletedCount: 0, error: null, limitation };
  }

  private async syncHierarchy(tenantId: string, accountId: string, worker: string, correlationId: string, started: number, limitation: string | null): Promise<WorkerRunResult> {
    try {
      const check = await this.avito.request<unknown>(tenantId, accountId, 'GET', '/checkAhUserV2');
      let info: unknown = null;
      try {
        info = await this.avito.request(tenantId, accountId, 'GET', '/getAhInfoV1');
      } catch {
        /* company key required */
      }
      await this.saveSnapshot(tenantId, accountId, 'hierarchy', { check, info }, 1);
      return { worker, status: info ? 'completed' : 'limited', latencyMs: Date.now() - started, sourceCount: 1, updatedCount: info ? 1 : 0, deletedCount: 0, error: info ? null : 'Company hierarchy key required', limitation };
    } catch (e) {
      return { worker, status: 'limited', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation };
    }
  }

  private async syncPhones(tenantId: string, accountId: string, worker: string, correlationId: string, started: number, limitation: string | null): Promise<WorkerRunResult> {
    try {
      const phones = await this.avito.request<unknown>(tenantId, accountId, 'GET', '/listCompanyPhonesV1');
      const count = Array.isArray(phones) ? phones.length : 1;
      await this.saveSnapshot(tenantId, accountId, 'phones', phones as object, count);
      return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: count, updatedCount: count, deletedCount: 0, error: null, limitation };
    } catch (e) {
      return { worker, status: 'limited', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation };
    }
  }

  private async syncEmployees(tenantId: string, accountId: string, worker: string, correlationId: string, started: number, limitation: string | null): Promise<WorkerRunResult> {
    try {
      const employees = await this.avito.request<unknown>(tenantId, accountId, 'GET', '/getEmployeesV1');
      const count = Array.isArray(employees) ? employees.length : 1;
      await this.saveSnapshot(tenantId, accountId, 'employees', employees as object, count);
      return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: count, updatedCount: count, deletedCount: 0, error: null, limitation };
    } catch (e) {
      return { worker, status: 'limited', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation };
    }
  }

  private async syncRatings(tenantId: string, accountId: string, worker: string, correlationId: string, started: number): Promise<WorkerRunResult> {
    try {
      const ratings = await this.avito.request<unknown>(tenantId, accountId, 'GET', '/ratings/v1/info');
      await this.saveSnapshot(tenantId, accountId, 'ratings', ratings as object, 1);
      return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: 1, updatedCount: 1, deletedCount: 0, error: null, limitation: null };
    } catch (e) {
      return { worker, status: 'failed', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation: null };
    }
  }

  private async syncReviews(tenantId: string, accountId: string, worker: string, correlationId: string, started: number): Promise<WorkerRunResult> {
    try {
      const reviews = await this.avito.request<unknown>(tenantId, accountId, 'GET', '/ratings/v1/reviews', { query: { limit: 20 } });
      const count = typeof reviews === 'object' && reviews && 'reviews' in reviews && Array.isArray((reviews as { reviews: unknown[] }).reviews)
        ? (reviews as { reviews: unknown[] }).reviews.length
        : 1;
      await this.saveSnapshot(tenantId, accountId, 'reviews', reviews as object, count);
      return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: count, updatedCount: count, deletedCount: 0, error: null, limitation: null };
    } catch (e) {
      return { worker, status: 'failed', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation: null };
    }
  }

  private async syncStock(tenantId: string, accountId: string, worker: string, correlationId: string, started: number, limitation: string | null): Promise<WorkerRunResult> {
    const ads = await this.prisma.adReadModel.findMany({ where: { tenantId, marketplace: MarketplaceCode.AVITO }, take: 10 });
    const itemIds = ads.map((a) => a.externalId).filter(Boolean) as string[];
    if (!itemIds.length) {
      return { worker, status: 'limited', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: 'No items for stock API', limitation };
    }
    try {
      const stock = await this.avito.request<unknown>(tenantId, accountId, 'POST', '/stock-management/1/info', { body: { itemIds } });
      await this.saveSnapshot(tenantId, accountId, 'stock', stock as object, itemIds.length);
      return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: itemIds.length, updatedCount: itemIds.length, deletedCount: 0, error: null, limitation };
    } catch (e) {
      return { worker, status: 'limited', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation };
    }
  }

  private async syncCallTracking(tenantId: string, accountId: string, worker: string, correlationId: string, started: number, limitation: string | null): Promise<WorkerRunResult> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86400_000);
    try {
      const calls = await this.avito.request<unknown>(tenantId, accountId, 'POST', '/calltracking/v1/getCalls/', {
        body: { dateFrom: dayAgo.toISOString(), dateTo: now.toISOString() },
      });
      await this.saveSnapshot(tenantId, accountId, 'call_tracking', calls as object, 1);
      return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: 1, updatedCount: 1, deletedCount: 0, error: null, limitation };
    } catch (e) {
      return { worker, status: 'limited', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: e instanceof Error ? e.message : String(e), limitation };
    }
  }

  private async syncApiCatalog(tenantId: string, accountId: string, worker: string, started: number): Promise<WorkerRunResult> {
    const dir = join(process.cwd(), 'docs', 'avito-openapi');
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      return { worker, status: 'unavailable', latencyMs: Date.now() - started, sourceCount: 0, updatedCount: 0, deletedCount: 0, error: 'OpenAPI catalog not found', limitation: 'Local docs only' };
    }
    const sections = files.map((f) => ({ section: f.replace('.json', ''), file: f }));
    await this.saveSnapshot(tenantId, accountId, 'api_catalog', { sections, totalSections: sections.length }, sections.length);
    return { worker, status: 'completed', latencyMs: Date.now() - started, sourceCount: sections.length, updatedCount: sections.length, deletedCount: 0, error: null, limitation: 'Local OpenAPI catalog' };
  }

  private async saveSnapshot(tenantId: string, accountId: string, domain: string, payload: object, itemCount: number): Promise<void> {
    await this.prisma.avitoLiveSnapshotReadModel.upsert({
      where: { tenantId_accountId_domain: { tenantId, accountId, domain } },
      create: { tenantId, accountId, domain, payload, itemCount, updatedAt: new Date() },
      update: { payload, itemCount, updatedAt: new Date() },
    });
  }

  private async logRequest(
    tenantId: string,
    accountId: string,
    worker: string,
    correlationId: string,
    method: string,
    path: string,
    status: number,
    latencyMs: number,
  ): Promise<void> {
    await this.requestLog.log({
      tenantId,
      accountId,
      correlationId,
      worker,
      method,
      url: path,
      status,
      latencyMs,
    });
  }

  private async publishDomainEvent(
    tenantId: string,
    accountId: string,
    worker: string,
    result: WorkerRunResult,
    ctx: AppendContext,
  ): Promise<void> {
    if (result.status !== 'completed') return;
    const now = new Date().toISOString();
    const map: Partial<Record<string, AvitoEventType>> = {
      [AvitoSyncWorker.Profile]: AvitoEventType.ProfileUpdated,
      [AvitoSyncWorker.Items]: AvitoEventType.ItemsUpdated,
      [AvitoSyncWorker.Messenger]: AvitoEventType.ChatsUpdated,
      [AvitoSyncWorker.Stats]: AvitoEventType.StatsUpdated,
      [AvitoSyncWorker.Ratings]: AvitoEventType.RatingsUpdated,
      [AvitoSyncWorker.Tariff]: AvitoEventType.TariffUpdated,
      [AvitoSyncWorker.Promotion]: AvitoEventType.PromotionUpdated,
      [AvitoSyncWorker.Autoload]: AvitoEventType.AutoloadUpdated,
    };
    const type = map[worker];
    if (!type) return;

    const payloads: Record<string, Record<string, unknown>> = {
      [AvitoEventType.ProfileUpdated]: { accountId, externalAccountId: '', displayName: '', updatedAt: now },
      [AvitoEventType.ItemsUpdated]: { accountId, received: result.sourceCount, updated: result.updatedCount, deleted: result.deletedCount, updatedAt: now },
      [AvitoEventType.ChatsUpdated]: { accountId, chatCount: result.sourceCount, updatedAt: now },
      [AvitoEventType.StatsUpdated]: { accountId, adIds: [], updatedAt: now },
      [AvitoEventType.RatingsUpdated]: { accountId, rating: null, reviewCount: result.sourceCount, updatedAt: now },
      [AvitoEventType.TariffUpdated]: { accountId, tariff: {}, updatedAt: now },
      [AvitoEventType.PromotionUpdated]: { accountId, servicesCount: result.sourceCount, updatedAt: now },
      [AvitoEventType.AutoloadUpdated]: { accountId, uploadsCount: result.sourceCount, profileAvailable: true, updatedAt: now },
    };

    const snap = await this.prisma.avitoLiveSnapshotReadModel.findFirst({ where: { tenantId, accountId, domain: worker === AvitoSyncWorker.Profile ? 'profile' : worker } });
    if (worker === AvitoSyncWorker.Profile && snap?.payload && typeof snap.payload === 'object') {
      const p = snap.payload as { id?: number; name?: string };
      payloads[AvitoEventType.ProfileUpdated] = {
        accountId,
        externalAccountId: String(p.id ?? ''),
        displayName: String(p.name ?? ''),
        updatedAt: now,
      };
    }

    await this.publisher.publish(tenantId, `live:${accountId}`, type, payloads[type]!, ctx);
  }

  async getDueWorkers(limit = 20): Promise<{ tenantId: string; accountId: string; worker: string }[]> {
    const now = new Date();
    const rows = await this.prisma.avitoLiveSyncWorkerReadModel.findMany({
      where: { enabled: true, nextSyncAt: { lte: now } },
      take: limit,
      orderBy: { nextSyncAt: 'asc' },
    });
    return rows.map((r) => ({ tenantId: r.tenantId, accountId: r.accountId, worker: r.worker }));
  }
}
