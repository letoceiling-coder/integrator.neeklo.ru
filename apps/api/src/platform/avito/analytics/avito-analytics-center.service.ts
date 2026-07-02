import { Injectable } from '@nestjs/common';
import { MarketplaceCode } from '@neeklo/contracts';
import type { AvitoAnalyticsSummaryDto } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { ForecastEngine } from '../../intelligence/forecast/forecast.engine';
import { RecommendationEngine } from '../../marketplace-core/recommendation/recommendation.engine';
import { MarketplaceSyncService } from '../../marketplace-core/services/marketplace.services';

/** Avito Analytics Center — aggregates projection + API stats where available. */
@Injectable()
export class AvitoAnalyticsCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastEngine,
    private readonly recommendations: RecommendationEngine,
    private readonly sync: MarketplaceSyncService,
  ) {}

  async getSummary(tenantId: string): Promise<AvitoAnalyticsSummaryDto> {
    const ads = await this.prisma.adReadModel.findMany({
      where: { tenantId, marketplace: MarketplaceCode.AVITO },
    });

    const views = ads.reduce((s, a) => s + a.views, 0);
    const contacts = ads.reduce((s, a) => s + a.contacts, 0);
    const favorites = ads.reduce((s, a) => s + a.favorites, 0);
    const messages = ads.reduce((s, a) => s + a.messages, 0);
    const spend = ads.reduce((s, a) => s + a.spendAmount, 0);
    const revenue = ads.reduce((s, a) => s + a.revenueAmount, 0);
    const ctr = views > 0 ? contacts / views : 0;
    const conversionRate = views > 0 ? messages / views : 0;

    const recs = await this.recommendations.listPending(tenantId);
    const avgAiScore = ads.length ? ads.reduce((s, a) => s + (a.aiScore ?? 0), 0) / ads.length : null;

    let forecastTrend: 'up' | 'down' | 'stable' | null = null;
    const topAd = ads.sort((a, b) => b.views - a.views)[0];
    if (topAd) {
      const fc = await this.forecast.getLatest(tenantId, 'ad', topAd.id);
      forecastTrend = fc ? 'stable' : null;
    }

    const manualImports = await this.prisma.budgetImportReadModel.count({ where: { tenantId } });

    return {
      views,
      contacts,
      favorites,
      messages,
      ctr,
      conversionRate,
      spend,
      revenue,
      roi: spend > 0 ? (revenue - spend) / spend : 0,
      roas: spend > 0 ? revenue / spend : 0,
      cpa: contacts > 0 ? spend / contacts : 0,
      aiScore: avgAiScore,
      forecastTrend,
      recommendationCount: recs.length,
      dataSource: manualImports > 0 ? 'mixed' : 'projection',
    };
  }

  async getAdAnalytics(tenantId: string, adId: string) {
    const ad = await this.prisma.adReadModel.findFirst({ where: { id: adId, tenantId } });
    if (!ad) return null;

    const [forecast, recs] = await Promise.all([
      this.forecast.getLatest(tenantId, 'ad', adId),
      this.recommendations.listPending(tenantId, 'ad', adId),
    ]);

    return {
      ad,
      forecast,
      recommendations: recs,
      metrics: {
        views: ad.views,
        contacts: ad.contacts,
        favorites: ad.favorites,
        ctr: ad.ctr,
        roi: ad.roi,
        spend: ad.spendAmount,
        costPerContact: ad.costPerContact,
      },
    };
  }

  async pullAvitoStats(tenantId: string, accountId: string) {
    try {
      const result = await this.sync.syncAccount(accountId, tenantId);
      return { ok: true, result, dataSource: 'avito_api' as const };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'sync_unsupported',
        note: 'Avito full sync requires Autoload module. Using projection metrics.',
        dataSource: 'projection' as const,
      };
    }
  }
}
