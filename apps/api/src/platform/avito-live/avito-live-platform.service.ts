import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import {
  AvitoEventType,
  MarketplaceCode,
  AVITO_SYNC_INTERVAL_SEC,
  type AvitoSyncInterval,
  type AvitoAccountOverviewDto,
  type AvitoApiUsageDto,
  type AvitoExplorerNodeDto,
  type AvitoLiveHealthDto,
  type AvitoSyncDashboardDto,
  type AvitoSyncInspectorEntryDto,
  type AvitoTimelineEntryDto,
  type AvitoWebhookCenterDto,
} from '@neeklo/contracts';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { AvitoLiveSyncEngineService } from './sync/avito-live-sync-engine.service';
import { AvitoLiveRequestLogService } from './logging/avito-live-request-log.service';
import { AvitoEventPublisher } from '../avito/events/avito-event.publisher';

@Injectable()
export class AvitoLivePlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly engine: AvitoLiveSyncEngineService,
    private readonly requestLog: AvitoLiveRequestLogService,
    private readonly publisher: AvitoEventPublisher,
  ) {}

  async triggerFullSync(tenantId: string, accountId: string, correlationId?: string) {
    await this.engine.ensureWorkers(tenantId, accountId);
    this.engine.enqueueFullSync(tenantId, accountId, correlationId);
    await this.engine.processQueue(20);
    return this.getDashboard(tenantId, accountId);
  }

  async getDashboard(tenantId: string, accountId: string): Promise<AvitoSyncDashboardDto> {
    await this.engine.ensureWorkers(tenantId, accountId);
    const workers = await this.prisma.avitoLiveSyncWorkerReadModel.findMany({
      where: { tenantId, accountId },
      orderBy: { worker: 'asc' },
    });
    const usage = await this.requestLog.usageStats(tenantId, 3600_000);
    const lastSync = workers.reduce<Date | null>((max, w) => {
      if (!w.lastSyncAt) return max;
      return !max || w.lastSyncAt > max ? w.lastSyncAt : max;
    }, null);

    return {
      accountId,
      workers: workers.map((w) => ({
        worker: w.worker,
        label: w.label,
        officialApi: w.officialApi,
        intervalSec: w.intervalSec,
        enabled: w.enabled,
        lastSyncAt: w.lastSyncAt?.toISOString() ?? null,
        nextSyncAt: w.nextSyncAt?.toISOString() ?? null,
        status: w.lastStatus as AvitoSyncDashboardDto['workers'][0]['status'],
        latencyMs: w.lastLatencyMs,
        lastError: w.lastError,
        retryCount: w.retryCount,
        sourceCount: w.sourceCount,
        updatedCount: w.updatedCount,
        deletedCount: w.deletedCount,
        version: w.version,
        limitation: w.limitation,
      })),
      queueDepth: this.engine.getQueueDepth(),
      activeWorker: this.engine.getActiveWorker(),
      lastFullSyncAt: lastSync?.toISOString() ?? null,
      apiRequestsLastHour: usage.requestsLastHour,
      rateLimitRemaining: usage.rateLimitRemaining,
    };
  }

  async getAccountOverview(tenantId: string, accountId: string): Promise<AvitoAccountOverviewDto> {
    const account = await this.prisma.accountReadModel.findFirst({ where: { id: accountId, organizationId: tenantId } });
    const detail = await this.prisma.avitoAccountDetailReadModel.findFirst({ where: { tenantId, accountId } });
    const profile = await this.prisma.avitoLiveSnapshotReadModel.findUnique({
      where: { tenantId_accountId_domain: { tenantId, accountId, domain: 'profile' } },
    });
    const tariff = await this.prisma.avitoLiveSnapshotReadModel.findUnique({
      where: { tenantId_accountId_domain: { tenantId, accountId, domain: 'tariff' } },
    });
    const webhook = await this.prisma.avitoWebhookConfigReadModel.findFirst({ where: { tenantId, accountId } });
    const workers = await this.prisma.avitoLiveSyncWorkerReadModel.findMany({ where: { tenantId, accountId } });

    const p = (profile?.payload ?? {}) as Record<string, unknown>;
    const balance = p.balance as { real?: number } | null;

    return {
      accountId,
      displayName: account?.displayName ?? 'Avito Account',
      externalAccountId: account?.externalAccountId ?? detail?.externalAccountId ?? null,
      accountType: typeof p.type === 'string' ? p.type : null,
      companyName: typeof p.name === 'string' ? p.name : null,
      tariff: tariff?.payload ?? null,
      balanceRub: balance?.real != null ? balance.real / 100 : detail?.balanceRub ?? null,
      phone: typeof p.phone === 'string' ? p.phone : null,
      email: typeof p.email === 'string' ? p.email : null,
      connectedAt: account?.createdAt?.toISOString() ?? null,
      lastSyncAt: detail?.lastSyncAt?.toISOString() ?? null,
      apiHealth: workers.some((w) => w.lastStatus === 'completed') ? 'healthy' : 'degraded',
      webhookStatus: webhook?.status ?? 'not_configured',
      promotionAvailable: workers.some((w) => w.worker === 'promotion' && w.lastStatus === 'completed'),
      messengerAvailable: workers.some((w) => w.worker === 'messenger' && w.lastStatus === 'completed'),
      autoloadAvailable: workers.some((w) => w.worker === 'autoload' && w.lastStatus === 'completed'),
      limitations: workers.filter((w) => w.limitation).map((w) => `${w.label}: ${w.limitation}`),
    };
  }

  async getExplorer(tenantId: string, accountId: string): Promise<AvitoExplorerNodeDto> {
    const workers = await this.prisma.avitoLiveSyncWorkerReadModel.findMany({ where: { tenantId, accountId } });
    const snapshots = await this.prisma.avitoLiveSnapshotReadModel.findMany({ where: { tenantId, accountId } });
    const snapMap = new Map(snapshots.map((s) => [s.domain, s]));

    const child = (type: string, label: string, domain: string): AvitoExplorerNodeDto => {
      const w = workers.find((x) => x.worker === domain);
      const s = snapMap.get(domain);
      return {
        id: domain,
        label,
        type,
        count: s?.itemCount ?? null,
        status: (w?.lastStatus ?? 'pending') as AvitoExplorerNodeDto['status'],
      };
    };

    return {
      id: accountId,
      label: 'Avito Account',
      type: 'account',
      count: null,
      status: 'completed',
      children: [
        child('items', 'Объявления', 'items'),
        child('messenger', 'Сообщения', 'messenger'),
        child('reviews', 'Отзывы', 'reviews'),
        child('ratings', 'Рейтинг', 'ratings'),
        child('categories', 'Категории', 'categories'),
        child('promotion', 'Продвижение', 'promotion'),
        child('autoload', 'Автозагрузка', 'autoload'),
        child('phones', 'Телефоны', 'phones'),
        child('employees', 'Сотрудники', 'employees'),
        child('hierarchy', 'Иерархия', 'hierarchy'),
        child('stats', 'Статистика', 'stats'),
        child('call_tracking', 'Call Tracking', 'call_tracking'),
        child('stock', 'Остатки', 'stock'),
      ],
    };
  }

  async getApiUsage(tenantId: string): Promise<AvitoApiUsageDto> {
    const hour = await this.requestLog.usageStats(tenantId, 3600_000);
    const day = await this.requestLog.usageStats(tenantId, 86400_000);
    return {
      requestsLastHour: hour.requestsLastHour,
      requestsLastDay: day.requestsLastHour,
      rateLimitRemaining: hour.rateLimitRemaining,
      rateLimitReset: null,
      errors429: hour.errors429,
      avgLatencyMs: hour.avgLatencyMs,
      heaviestRequests: hour.heaviestRequests,
      recentErrors: hour.recentErrors,
    };
  }

  async getWebhookCenter(tenantId: string, accountId: string): Promise<AvitoWebhookCenterDto> {
    const apiUrl = this.config.get('API_URL', { infer: true }).replace(/\/$/, '');
    const webhookUrl = `${apiUrl}/api/webhooks/avito?tenantId=${tenantId}&accountId=${accountId}`;
    const row = await this.prisma.avitoWebhookConfigReadModel.upsert({
      where: { tenantId_accountId: { tenantId, accountId } },
      create: { tenantId, accountId, webhookUrl, status: 'pending', history: [] },
      update: { webhookUrl },
    });
    return {
      webhookUrl: row.webhookUrl,
      status: row.status,
      subscriptionId: row.subscriptionId,
      lastReceivedAt: row.lastReceivedAt?.toISOString() ?? null,
      lastError: row.lastError,
      history: (row.history as AvitoWebhookCenterDto['history']) ?? [],
    };
  }

  async getTimeline(tenantId: string, accountId: string, limit = 50): Promise<AvitoTimelineEntryDto[]> {
    const entries: AvitoTimelineEntryDto[] = [];

    const logs = await this.requestLog.listRecent(tenantId, limit);
    for (const l of logs.filter((x) => x.accountId === accountId)) {
      entries.push({
        id: l.requestId,
        at: l.occurredAt.toISOString(),
        kind: l.status >= 400 ? 'error' : 'sync',
        title: `${l.method} ${l.worker ?? 'api'}`,
        detail: l.status >= 400 ? l.responsePreview : `${l.latencyMs}ms`,
        correlationId: l.correlationId,
      });
    }

    const workers = await this.prisma.avitoLiveSyncWorkerReadModel.findMany({
      where: { tenantId, accountId },
      orderBy: { lastSyncAt: 'desc' },
    });
    for (const w of workers) {
      if (!w.lastSyncAt) continue;
      entries.push({
        id: `sync-${w.worker}`,
        at: w.lastSyncAt.toISOString(),
        kind: 'sync',
        title: `Sync: ${w.label}`,
        detail: w.lastError ?? `${w.updatedCount} updated`,
        correlationId: null,
      });
    }

    return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  async getInspector(tenantId: string, accountId: string): Promise<AvitoSyncInspectorEntryDto[]> {
    const workers = await this.prisma.avitoLiveSyncWorkerReadModel.findMany({ where: { tenantId, accountId } });
    return workers.map((w) => ({
      worker: w.worker,
      entityType: w.label,
      source: w.officialApi,
      received: w.sourceCount,
      updated: w.updatedCount,
      deleted: w.deletedCount,
      version: w.version,
      updatedAt: w.lastSyncAt?.toISOString() ?? null,
      retryCount: w.retryCount,
      status: w.lastStatus as AvitoSyncInspectorEntryDto['status'],
    }));
  }

  async getHealth(tenantId: string, accountId: string): Promise<AvitoLiveHealthDto> {
    const dashboard = await this.getDashboard(tenantId, accountId);
    const webhook = await this.getWebhookCenter(tenantId, accountId);
    const snapshots = await this.prisma.avitoLiveSnapshotReadModel.count({ where: { tenantId, accountId } });
    const okWorkers = dashboard.workers.filter((w) => w.status === 'completed').length;

    return {
      oauth: { status: 'pass', message: 'OAuth handled by OAuth Center (read-only)' },
      vault: { status: 'pass', message: 'Credential Vault (read-only)' },
      avitoApi: {
        status: okWorkers > 0 ? 'pass' : 'warn',
        latencyMs: dashboard.workers.find((w) => w.latencyMs)?.latencyMs ?? 0,
        message: `${okWorkers} workers OK`,
      },
      webhook: { status: webhook.lastReceivedAt ? 'pass' : 'warn', message: webhook.status },
      sync: { status: okWorkers === dashboard.workers.length ? 'pass' : 'warn', workersOk: okWorkers, workersTotal: dashboard.workers.length },
      queues: { status: dashboard.queueDepth > 10 ? 'warn' : 'pass', depth: dashboard.queueDepth },
      workers: { status: dashboard.activeWorker ? 'pass' : 'pass', active: dashboard.activeWorker ? 1 : 0 },
      readModels: { status: snapshots > 0 ? 'pass' : 'warn', snapshots },
      storage: { status: 'pass', message: 'PostgreSQL read models' },
      ai: { status: 'pass', message: 'AI reads read models only — no direct Avito API' },
    };
  }

  updateSchedule(tenantId: string, accountId: string, worker: string, interval: AvitoSyncInterval, enabled?: boolean) {
    return this.engine.ensureWorkers(tenantId, accountId).then(() =>
      this.prisma.avitoLiveSyncWorkerReadModel.update({
        where: { tenantId_accountId_worker: { tenantId, accountId, worker } },
        data: {
          intervalSec: AVITO_SYNC_INTERVAL_SEC[interval],
          enabled: enabled ?? undefined,
          nextSyncAt: new Date(),
        },
      }),
    );
  }

  async handleWebhook(
    tenantId: string,
    accountId: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    const now = new Date();
    const row = await this.prisma.avitoWebhookConfigReadModel.findFirst({ where: { tenantId, accountId } });
    const history = [...((row?.history as object[]) ?? []), { at: now.toISOString(), eventType, ok: true }].slice(-50);

    await this.prisma.avitoWebhookConfigReadModel.upsert({
      where: { tenantId_accountId: { tenantId, accountId } },
      create: {
        tenantId,
        accountId,
        webhookUrl: '',
        status: 'active',
        lastReceivedAt: now,
        history,
      },
      update: { status: 'active', lastReceivedAt: now, lastError: null, history },
    });

    await this.publisher.publish(tenantId, `webhook:${accountId}`, AvitoEventType.WebhookReceived, {
      marketplace: MarketplaceCode.AVITO,
      eventType,
      receivedAt: now.toISOString(),
    });

    await this.publisher.publish(tenantId, `live:${accountId}`, AvitoEventType.WebhookUpdated, {
      accountId,
      status: 'active',
      webhookUrl: row?.webhookUrl ?? '',
      updatedAt: now.toISOString(),
    });

    await this.engine.enqueueWorker(tenantId, accountId, 'messenger', uuid());
  }
}
