import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MarketplaceCode,
  OAuthCredentialStatus,
  type OAuthCheckStatus,
  type OAuthConnectionReportDto,
  type OAuthConnectionSectionDto,
  type OAuthIntegrationDashboardDto,
  type OAuthSyncWizardStepDto,
} from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AvitoClient } from '../adapters/avito/avito.client';
import { CredentialVaultService } from './vault/credential-vault.service';
import { OAuthValidationService } from './oauth-validation.service';
import { friendlyAvitoError } from './avito-api-errors';

@Injectable()
export class OAuthConnectionReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: CredentialVaultService,
    private readonly validation: OAuthValidationService,
    private readonly avito: AvitoClient,
  ) {}

  async buildReport(tenantId: string, accountId: string): Promise<OAuthConnectionReportDto> {
    const credential = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!credential) throw new NotFoundException('OAuth credential not found');

    const detail = await this.prisma.avitoAccountDetailReadModel.findFirst({ where: { tenantId, accountId } });
    const account = await this.prisma.accountReadModel.findFirst({ where: { id: accountId, organizationId: tenantId } });
    const syncSteps = this.readSyncSteps(detail?.syncHistory);

    const [validation, checklist, health, usage, workers, overview] = await Promise.all([
      this.validation.runSuite(tenantId, accountId),
      this.validation.getProductionChecklist(tenantId, accountId),
      this.validation.getHealthDashboard(tenantId, accountId),
      this.usageStats(tenantId, 3600_000),
      this.prisma.avitoLiveSyncWorkerReadModel.findMany({ where: { tenantId, accountId }, orderBy: { worker: 'asc' } }),
      this.loadAccountOverview(tenantId, accountId),
    ]);

    let selfId: number | null = null;
    let profileSection: OAuthConnectionSectionDto = { status: 'fail', message: 'Profile not fetched' };
    let profileMs: number | null = null;

    try {
      const started = Date.now();
      const profile = await this.avito.request<{
        id: number;
        name?: string;
        email?: string;
        phone?: string;
        profile_type?: string;
        type?: string;
      }>(tenantId, accountId, 'GET', '/core/v1/accounts/self');
      profileMs = Date.now() - started;
      selfId = profile.id;
      profileSection = {
        status: 'pass',
        message: profile.name ?? `Avito #${profile.id}`,
        latencyMs: profileMs,
        details: { email: profile.email, phone: profile.phone, type: profile.profile_type ?? profile.type },
      };
    } catch (e) {
      profileSection = {
        status: 'fail',
        message: friendlyAvitoError(e, 'Профиль'),
        recommendation: 'Переподключите OAuth или проверьте scope user:read',
      };
    }

    const tariffSection = await this.probeTariff(tenantId, accountId);
    const apis = await this.probeApis(tenantId, accountId, selfId);
    const messengerSection = await this.probeMessenger(tenantId, accountId, selfId);
    const feedSection = await this.probeFeed(tenantId, accountId);
    const webhookSection = await this.probeWebhook(tenantId, accountId);

    const adsCount = await this.countAds(tenantId, accountId);
    const messagesCount = messengerSection.chatCount ?? 0;

    const oauthSection: OAuthConnectionReportDto['oauth'] = {
      status: checklist.oauth,
      message:
        checklist.oauth === 'pass'
          ? 'OAuth подключён, redirect URI совпадает'
          : 'OAuth не готов — проверьте redirect URI и статус credential',
      recommendation: checklist.oauth !== 'pass' ? 'Убедитесь, что Redirect URI в Avito Portal = production callback' : undefined,
      validation,
      checklist,
    };

    const supportedApis = workers
      .filter((w) => w.lastStatus === 'completed')
      .map((w) => w.officialApi);

    const lastSync = workers.reduce<Date | null>((max, w) => {
      if (!w.lastSyncAt) return max;
      return !max || w.lastSyncAt > max ? w.lastSyncAt : max;
    }, null);

    const audit = this.buildAudit({
      validation,
      checklist,
      profileSection,
      adsCount,
      messengerSection,
      feedSection,
      webhookSection,
      health,
    });

    const probes = [profileSection, tariffSection, ...Object.values(apis), messengerSection, feedSection, webhookSection];
    const latencies = probes.map((p) => p.latencyMs).filter((n): n is number => n != null);
    const avgProbeMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

    const overallStatus = this.overallFromAudit(audit);

    return {
      accountId,
      generatedAt: new Date().toISOString(),
      overallStatus,
      audit,
      oauth: oauthSection,
      account: {
        displayName: account?.displayName ?? credential.displayName,
        externalAccountId: credential.externalAccountId ?? overview?.externalAccountId ?? null,
        companyName: overview?.companyName ?? null,
        accountType: overview?.accountType ?? null,
        status: detail?.status ?? credential.status,
      },
      profile: profileSection,
      tariff: tariffSection,
      scopes: credential.scopes,
      supportedApis,
      apis,
      sync: {
        steps: syncSteps,
        adsCount,
        messagesCount,
        lastSyncAt: detail?.lastSyncAt?.toISOString() ?? lastSync?.toISOString() ?? null,
        liveWorkers: workers.map((w) => ({
          worker: w.worker,
          status: w.lastStatus,
          lastError: w.lastError,
        })),
      },
      messenger: messengerSection,
      feed: feedSection,
      webhook: webhookSection,
      health,
      latency: { profileMs, avgProbeMs },
      rateLimits: {
        remaining: usage.rateLimitRemaining,
        requestsLastHour: usage.requestsLastHour,
      },
    };
  }

  async getIntegrationDashboard(tenantId: string): Promise<OAuthIntegrationDashboardDto> {
    const credentials = await this.vault.listByTenant(tenantId, MarketplaceCode.AVITO);
    const connected = credentials.find((c) => c.status === OAuthCredentialStatus.CONNECTED);
    if (!connected) {
      return {
        accountId: null,
        connected: false,
        oauthStatus: 'fail',
        webhookStatus: 'warn',
        feedStatus: 'warn',
        adsCount: 0,
        messagesCount: 0,
        lastSyncAt: null,
        apiHealth: 'warn',
        overallStatus: 'fail',
      };
    }

    const report = await this.buildReport(tenantId, connected.accountId);
    return {
      accountId: connected.accountId,
      connected: true,
      oauthStatus: report.oauth.status,
      webhookStatus: report.webhook.status,
      feedStatus: report.feed.status,
      adsCount: report.sync.adsCount,
      messagesCount: report.sync.messagesCount,
      lastSyncAt: report.sync.lastSyncAt,
      apiHealth: report.health.avitoApi.status,
      overallStatus: report.overallStatus,
    };
  }

  private buildAudit(input: {
    validation: { failed: number };
    checklist: { oauth: OAuthCheckStatus; profile: OAuthCheckStatus; ads: OAuthCheckStatus; stats: OAuthCheckStatus; messenger: OAuthCheckStatus; webhook: OAuthCheckStatus; autoload: OAuthCheckStatus; health: OAuthCheckStatus };
    profileSection: OAuthConnectionSectionDto;
    adsCount: number;
    messengerSection: OAuthConnectionSectionDto & { chatCount?: number };
    feedSection: OAuthConnectionSectionDto;
    webhookSection: OAuthConnectionSectionDto;
    health: { avitoApi: { status: OAuthCheckStatus }; refresh: { status: OAuthCheckStatus } };
  }) {
    return {
      oauth: input.checklist.oauth === 'pass',
      tokenRefresh: input.health.refresh.status === 'pass',
      profile: input.profileSection.status === 'pass',
      account: input.checklist.profile === 'pass',
      adsSynced: input.adsCount > 0 || input.checklist.ads === 'pass',
      statsAvailable: input.checklist.stats === 'pass',
      messengerChecked: input.messengerSection.status !== 'fail',
      feedReady: input.feedSection.status === 'pass' || input.checklist.autoload === 'pass',
      webhookReady: input.webhookSection.status === 'pass',
      productionHealth: input.checklist.health === 'pass' && input.validation.failed === 0,
    };
  }

  private overallFromAudit(audit: OAuthConnectionReportDto['audit']): OAuthCheckStatus {
    const required = [
      audit.oauth,
      audit.tokenRefresh,
      audit.profile,
      audit.account,
      audit.adsSynced,
      audit.statsAvailable,
      audit.messengerChecked,
      audit.productionHealth,
    ];
    const passed = required.filter(Boolean).length;
    if (passed === required.length) return 'pass';
    if (passed >= required.length - 2) return 'warn';
    return 'fail';
  }

  private async probeTariff(tenantId: string, accountId: string): Promise<OAuthConnectionSectionDto> {
    const started = Date.now();
    try {
      const tariff = await this.avito.request<unknown>(tenantId, accountId, 'GET', '/tariff/info/1');
      return {
        status: 'pass',
        message: 'Тариф получен',
        latencyMs: Date.now() - started,
        details: tariff,
      };
    } catch (e) {
      return {
        status: 'warn',
        message: friendlyAvitoError(e, 'Тариф'),
        latencyMs: Date.now() - started,
        recommendation: 'Тариф может быть недоступен для client_credentials — проверьте тип OAuth grant',
      };
    }
  }

  private async probeApis(
    tenantId: string,
    accountId: string,
    selfId: number | null,
  ): Promise<OAuthConnectionReportDto['apis']> {
    const core = await this.probeSimple(tenantId, accountId, 'Core API', () =>
      this.avito.request(tenantId, accountId, 'GET', '/core/v1/accounts/self'),
    );

    const statistics = selfId
      ? await this.probeSimple(tenantId, accountId, 'Statistics API', () => {
          const today = new Date().toISOString().slice(0, 10);
          return this.avito.request(tenantId, accountId, 'POST', `/stats/v1/accounts/${selfId}/items`, {
            body: {
              dateFrom: today,
              dateTo: today,
              fields: ['uniqViews'],
              itemIds: [],
              periodGrouping: 'day',
            },
          });
        })
      : { status: 'fail' as const, message: 'Statistics API: нет accountId', recommendation: 'Сначала получите профиль' };

    const messenger = selfId
      ? await this.probeSimple(tenantId, accountId, 'Messenger API', () =>
          this.avito.request(tenantId, accountId, 'GET', `/messenger/v2/accounts/${selfId}/chats`, {
            query: { limit: 1 },
          }),
        )
      : { status: 'fail' as const, message: 'Messenger API: нет accountId' };

    const autoload = await this.probeSimple(tenantId, accountId, 'Autoload API', () =>
      this.avito.request(tenantId, accountId, 'GET', '/autoload/v2/profile'),
    );

    const promotion = await this.probeSimple(tenantId, accountId, 'Promotion API', async () => {
      if (!selfId) throw new Error('No account id');
      return this.avito.request(tenantId, accountId, 'GET', `/core/v1/accounts/${selfId}/items/vas/prices`, {
        query: { itemIds: '' },
      });
    });

    return { core, statistics, messenger, autoload, promotion };
  }

  private async probeSimple(
    tenantId: string,
    accountId: string,
    label: string,
    fn: () => Promise<unknown>,
  ): Promise<OAuthConnectionSectionDto> {
    const started = Date.now();
    try {
      await fn();
      return { status: 'pass', message: `${label}: доступен`, latencyMs: Date.now() - started };
    } catch (e) {
      const msg = friendlyAvitoError(e, label);
      const isTariff = msg.includes('тариф') || msg.includes('403');
      return {
        status: isTariff ? 'warn' : 'fail',
        message: msg,
        latencyMs: Date.now() - started,
        recommendation: isTariff
          ? 'Подключите нужный тариф Avito или добавьте scopes в Developer Portal'
          : 'Проверьте OAuth scopes и переподключите аккаунт',
      };
    }
  }

  private async probeMessenger(
    tenantId: string,
    accountId: string,
    selfId: number | null,
  ): Promise<OAuthConnectionReportDto['messenger']> {
    if (!selfId) {
      return { status: 'fail', message: 'Messenger: профиль не получен', recommendation: 'Завершите OAuth' };
    }
    const started = Date.now();
    try {
      const chats = await this.avito.request<{ chats?: unknown[]; resources?: unknown[] }>(
        tenantId,
        accountId,
        'GET',
        `/messenger/v2/accounts/${selfId}/chats`,
        { query: { limit: 50 } },
      );
      const chatCount = (chats.chats ?? chats.resources ?? []).length;
      return {
        status: 'pass',
        message: `Messenger: ${chatCount} чат(ов)`,
        latencyMs: Date.now() - started,
        chatCount,
      };
    } catch (e) {
      const msg = friendlyAvitoError(e, 'Messenger');
      return {
        status: 'warn',
        message: msg,
        latencyMs: Date.now() - started,
        chatCount: 0,
        recommendation:
          'Для Messenger API нужен тариф с доступом к API и scopes messenger:read, messenger:write',
      };
    }
  }

  private async probeFeed(tenantId: string, accountId: string): Promise<OAuthConnectionReportDto['feed']> {
    const last = await this.prisma.avitoFeedExportReadModel.findFirst({
      where: { tenantId, accountId },
      orderBy: { version: 'desc' },
    });
    const ads = await this.prisma.adReadModel.count({
      where: { tenantId, marketplace: MarketplaceCode.AVITO },
    });

    let autoloadOk = false;
    const started = Date.now();
    try {
      await this.avito.request(tenantId, accountId, 'GET', '/autoload/v2/profile');
      autoloadOk = true;
    } catch {
      autoloadOk = false;
    }

    const valid = ads > 0 && (!last || last.adCount > 0);
    const status: OAuthCheckStatus = autoloadOk && valid ? 'pass' : autoloadOk || last ? 'warn' : 'fail';

    return {
      status,
      message: last
        ? `Feed v${last.version}: ${last.adCount} объявлений${autoloadOk ? ', Autoload profile OK' : ''}`
        : autoloadOk
          ? 'Autoload profile доступен, экспорт feed ещё не выполнен'
          : 'Feed не готов — выполните экспорт в Operations Center',
      latencyMs: Date.now() - started,
      valid,
      version: last?.version,
      adCount: last?.adCount ?? ads,
      recommendation: !last ? 'Operations Center → Feed Studio → Export XML' : undefined,
    };
  }

  private async probeWebhook(tenantId: string, accountId: string): Promise<OAuthConnectionSectionDto> {
    const cfg = await this.prisma.avitoWebhookConfigReadModel.findFirst({ where: { tenantId, accountId } });
    if (cfg?.lastReceivedAt && cfg.lastReceivedAt.getTime() > Date.now() - 7 * 86400_000) {
      return { status: 'pass', message: `Webhook активен, последнее событие ${cfg.lastReceivedAt.toISOString()}` };
    }
    if (cfg?.webhookUrl) {
      return {
        status: 'warn',
        message: 'Webhook URL настроен, события ещё не получены',
        recommendation: 'Отправьте тестовое событие из Avito или дождитесь первого webhook',
        details: { url: cfg.webhookUrl, status: cfg.status },
      };
    }
    return {
      status: 'warn',
      message: 'Webhook не настроен',
      recommendation: 'Production Center → Webhook Center → зарегистрируйте URL',
    };
  }

  private readSyncSteps(syncHistory: unknown): OAuthSyncWizardStepDto[] {
    if (!Array.isArray(syncHistory) || !syncHistory.length) return [];
    const latest = syncHistory[0] as { steps?: OAuthSyncWizardStepDto[] };
    return latest.steps ?? [];
  }

  private async loadAccountOverview(tenantId: string, accountId: string) {
    const account = await this.prisma.accountReadModel.findFirst({ where: { id: accountId, organizationId: tenantId } });
    const profile = await this.prisma.avitoLiveSnapshotReadModel.findUnique({
      where: { tenantId_accountId_domain: { tenantId, accountId, domain: 'profile' } },
    });
    const p = (profile?.payload ?? {}) as Record<string, unknown>;
    return {
      externalAccountId: account?.externalAccountId ?? null,
      companyName: typeof p.name === 'string' ? p.name : null,
      accountType: typeof p.type === 'string' ? p.type : null,
    };
  }

  private async usageStats(tenantId: string, sinceMs: number) {
    const since = new Date(Date.now() - sinceMs);
    const rows = await this.prisma.avitoLiveRequestLogReadModel.findMany({
      where: { tenantId, occurredAt: { gte: since } },
    });
    const lastRate = rows.find((r) => r.rateLimitRemaining != null)?.rateLimitRemaining ?? null;
    return { requestsLastHour: rows.length, rateLimitRemaining: lastRate };
  }

  private async countAds(tenantId: string, _accountId: string): Promise<number> {
    return this.prisma.adReadModel.count({
      where: { tenantId, marketplace: MarketplaceCode.AVITO },
    });
  }
}
