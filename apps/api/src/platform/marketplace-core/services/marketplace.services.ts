import { Injectable, Optional } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { MarketplaceCode } from '@neeklo/contracts';
import type { MarketplaceContext, PublishListingInput } from '@neeklo/marketplace-sdk';
import { NotFoundError, type AppendContext } from '@neeklo/kernel';
import { RequestContextService } from '../../context/request-context';
import { MarketplaceRegistryService } from '../registry/marketplace-registry.service';
import { SyncEngine } from '../sync/sync.engine';
import { MarketplacePolicyEngine } from '../policies/marketplace-policy.engine';
import { ObservabilityService } from '../observability/observability.service';
import { RecommendationEngine } from '../recommendation/recommendation.engine';
import { MetricsEngine } from '../metrics/metrics.engine';
import { ForecastEngine } from '../../intelligence/forecast/forecast.engine';
import { MarketplaceRepository } from '../../../modules/marketplace/domain/marketplace.repository';
import { MarketplaceAggregate } from '../../../modules/marketplace/domain/marketplace.aggregate';
import { AccountRepository } from '../../../modules/account/domain/account.repository';
import { AccountAggregate } from '../../../modules/account/domain/account.aggregate';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly registry: MarketplaceRegistryService,
    private readonly marketplaceRepo: MarketplaceRepository,
    private readonly accountRepo: AccountRepository,
    private readonly sync: SyncEngine,
    private readonly policies: MarketplacePolicyEngine,
    private readonly observability: ObservabilityService,
    private readonly ctx: RequestContextService,
    private readonly prisma: PrismaService,
  ) {}

  private appendContext(): AppendContext {
    const rc = this.ctx.require();
    return { tenantId: rc.tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  listMarketplaces() {
    return this.registry.listProviders().map((p) => ({
      code: p.manifest.marketplaceCode,
      name: p.manifest.name,
      version: p.manifest.version,
      capabilities: p.getCapabilityDescriptors().filter((c) => c.supported).map((c) => c.name),
    }));
  }

  listAccounts(organizationId: string) {
    return this.prisma.accountReadModel.findMany({ where: { organizationId } });
  }

  async connectMarketplace(code: MarketplaceCode, pluginId: string): Promise<{ id: string }> {
    const id = uuid();
    const mp = MarketplaceAggregate.register(id, code, pluginId);
    await this.marketplaceRepo.save(mp, this.appendContext());
    return { id };
  }

  async createAccount(organizationId: string, marketplace: MarketplaceCode, displayName: string): Promise<{ id: string }> {
    const id = uuid();
    const account = AccountAggregate.create(id, organizationId, marketplace, displayName);
    await this.accountRepo.save(account, { ...this.appendContext(), tenantId: organizationId });
    return { id };
  }
}

@Injectable()
export class MarketplaceAuthorizationService {
  constructor(
    private readonly registry: MarketplaceRegistryService,
    private readonly accountRepo: AccountRepository,
    private readonly ctx: RequestContextService,
  ) {}

  private appendContext(tenantId: string): AppendContext {
    const rc = this.ctx.require();
    return { tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  async authorizeAccount(accountId: string, organizationId: string): Promise<void> {
    const account = await this.accountRepo.load(accountId);
    if (!account) throw new NotFoundError('Account', accountId);

    const provider = this.registry.getProvider(account.snapshot.marketplace);
    const identity = provider.resolve('identity');
    if (!identity) throw new NotFoundError('Capability', 'identity');

    const ctx: MarketplaceContext = {
      organizationId,
      accountId,
      marketplaceCode: account.snapshot.marketplace,
      correlationId: this.ctx.require().correlationId,
    };

    try {
      const validation = await identity.validate(ctx);
      if (!validation.valid) {
        account.failAuthorization('Token validation failed');
      } else {
        const info = await provider.resolve('account')?.getInfo(ctx);
        account.authorize(info?.externalAccountId ?? accountId, validation.expiresAt ?? null);
      }
    } catch (e) {
      account.failAuthorization(e instanceof Error ? e.message : String(e));
    }
    await this.accountRepo.save(account, this.appendContext(organizationId));
  }
}

@Injectable()
export class MarketplaceSyncService {
  constructor(
    private readonly sync: SyncEngine,
    private readonly accountRepo: AccountRepository,
    private readonly ctx: RequestContextService,
  ) {}

  async syncAccount(accountId: string, organizationId: string, mode: 'full' | 'incremental' | 'reconcile' = 'incremental') {
    const account = await this.accountRepo.load(accountId);
    if (!account) throw new NotFoundError('Account', accountId);

    const rc = this.ctx.require();
    const { syncId, result } = await this.sync.run({
      tenantId: organizationId,
      accountId,
      marketplace: account.snapshot.marketplace,
      mode,
      correlationId: rc.correlationId,
    });

    account.startSync(syncId, mode);
    account.completeSync(syncId, {
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      restored: result.restored,
      skipped: result.skipped,
      conflicts: result.conflicts.length,
    });
    await this.accountRepo.save(account, { tenantId: organizationId, actor: rc.actor, correlationId: rc.correlationId });
    return { syncId, result };
  }
}

@Injectable()
export class MarketplaceHealthService {
  constructor(
    private readonly registry: MarketplaceRegistryService,
    private readonly marketplaceRepo: MarketplaceRepository,
    private readonly accountRepo: AccountRepository,
    private readonly ctx: RequestContextService,
  ) {}

  async checkMarketplace(marketplaceId: string, accountId: string | null, organizationId: string) {
    const mp = await this.marketplaceRepo.load(marketplaceId);
    if (!mp) throw new NotFoundError('Marketplace', marketplaceId);

    const provider = this.registry.getProvider(mp.snapshot.code);
    const health = provider.resolve('health');
    if (!health) return { status: 'unknown' as const };

    const ctx: MarketplaceContext = {
      organizationId,
      accountId: accountId ?? 'system',
      marketplaceCode: mp.snapshot.code,
      correlationId: this.ctx.require().correlationId,
    };

    const result = await health.check(ctx);
    mp.updateHealth(result.status, result.latencyMs, accountId);
    await this.marketplaceRepo.save(mp, { tenantId: organizationId, actor: this.ctx.require().actor, correlationId: ctx.correlationId });
    return result;
  }
}

@Injectable()
export class MarketplaceCapabilityService {
  constructor(private readonly registry: MarketplaceRegistryService) {}

  getCapabilities(code: MarketplaceCode) {
    const provider = this.registry.getProvider(code);
    return provider.getCapabilityDescriptors();
  }
}

@Injectable()
export class MarketplaceStatisticsService {
  constructor(private readonly registry: MarketplaceRegistryService) {}

  async fetchAdStats(
    code: MarketplaceCode,
    ctx: MarketplaceContext,
    externalAdId: string,
    range: { from: string; to: string },
  ) {
    const stats = this.registry.getProvider(code).resolve('statistics');
    if (!stats) throw new NotFoundError('Capability', 'statistics');
    return stats.fetchAdStats(ctx, externalAdId, range);
  }
}

@Injectable()
export class MarketplaceRecommendationService {
  constructor(private readonly recommendations: RecommendationEngine) {}

  listPending(tenantId: string) {
    return this.recommendations.listPending(tenantId);
  }

  accept(id: string) {
    return this.recommendations.accept(id);
  }

  dismiss(id: string) {
    return this.recommendations.dismiss(id);
  }
}

@Injectable()
export class MarketplaceForecastService {
  constructor(
    private readonly metrics: MetricsEngine,
    private readonly prisma: PrismaService,
    @Optional() private readonly forecastEngine?: ForecastEngine,
  ) {}

  async forecastAd(tenantId: string, adId: string) {
    const ad = await this.prisma.adReadModel.findFirst({ where: { id: adId, tenantId } });
    if (!ad) throw new NotFoundError('Ad', adId);

    if (this.forecastEngine) {
      const result = await this.forecastEngine.forecast(tenantId, 'ad', adId, 7);
      const ctrF = result.forecasts.find((f) => f.metric === 'ctr');
      const roiF = result.forecasts.find((f) => f.metric === 'roi');
      const viewsF = result.forecasts.find((f) => f.metric === 'views');
      return {
        algorithm: result.algorithm,
        ctrForecast: ctrF?.forecast ?? ad.ctr,
        roiForecast: roiF?.forecast ?? ad.roi,
        viewsForecast: viewsF?.forecast ?? ad.views,
        forecasts: result.forecasts,
        saleProbability: Math.min(0.95, ad.conversion * 2 + ad.ctr),
      };
    }

    const current = this.metrics.computeForAd(ad);
    return {
      ctrForecast: current.ctr * 1.05,
      roiForecast: current.roi * 0.98,
      saleProbability: Math.min(0.95, current.conversion * 2 + current.ctr),
    };
  }
}

@Injectable()
export class MarketplaceBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async getSpent(tenantId: string, range?: { from: string; to: string }) {
    const ads = await this.prisma.adReadModel.findMany({ where: { tenantId } });
    return { amount: ads.reduce((s, a) => s + a.spendAmount, 0), currency: 'RUB' };
  }
}

@Injectable()
export class MarketplacePublicationService {
  constructor(
    private readonly registry: MarketplaceRegistryService,
    private readonly policies: MarketplacePolicyEngine,
  ) {}

  async publish(code: MarketplaceCode, ctx: MarketplaceContext, input: PublishListingInput) {
    const provider = this.registry.getProvider(code);
    const publication = provider.resolve('publication');
    if (!publication) throw new NotFoundError('Capability', 'publication');
    this.policies.enforcePublication({
      tenantId: ctx.organizationId,
      accountId: ctx.accountId,
      marketplace: code,
      ad: {
        status: 'draft',
        photoCount: input.photoUrls.length,
        authorized: true,
        regionAllowed: true,
        withinLimits: true,
      },
    });
    return publication.publish(ctx, input);
  }
}

@Injectable()
export class MarketplaceModerationService {
  constructor(private readonly registry: MarketplaceRegistryService) {}

  async check(code: MarketplaceCode, ctx: MarketplaceContext, externalAdId: string) {
    const moderation = this.registry.getProvider(code).resolve('moderation');
    if (!moderation) return { status: 'approved' as const, reason: null, checkedAt: new Date().toISOString() };
    return moderation.check(ctx, externalAdId);
  }
}
