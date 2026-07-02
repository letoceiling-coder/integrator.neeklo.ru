import { Injectable, Logger } from '@nestjs/common';
import { IntelligenceEventType } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelligenceEventPublisher } from '../events/intelligence-event.publisher';

/**
 * Regional Intelligence Engine — aggregates ad performance by region and ranks opportunity.
 */
@Injectable()
export class RegionalIntelligenceEngine {
  private readonly logger = new Logger(RegionalIntelligenceEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: IntelligenceEventPublisher,
  ) {}

  async refresh(tenantId: string): Promise<void> {
    const ads = await this.prisma.adReadModel.findMany({ where: { tenantId } });
    const byRegion = new Map<string, typeof ads>();

    for (const ad of ads) {
      const list = byRegion.get(ad.regionId) ?? [];
      list.push(ad);
      byRegion.set(ad.regionId, list);
    }

    const ranked: { regionId: string; opportunityIndex: number }[] = [];

    for (const [regionId, regionAds] of byRegion) {
      const n = regionAds.length || 1;
      const avgViews = regionAds.reduce((s, a) => s + a.views, 0) / n;
      const avgContacts = regionAds.reduce((s, a) => s + a.contacts, 0) / n;
      const totalSpend = regionAds.reduce((s, a) => s + a.spendAmount, 0);
      const totalRevenue = regionAds.reduce((s, a) => s + a.revenueAmount, 0);
      const roi = totalSpend > 0 ? (totalRevenue - totalSpend) / totalSpend : 0;
      const ctr = regionAds.reduce((s, a) => s + a.ctr, 0) / n;
      const avgPrice = regionAds.reduce((s, a) => s + a.priceAmount, 0) / n;
      const demand = avgContacts / Math.max(1, avgViews);
      const supply = n;
      const competition = supply / Math.max(0.01, demand);
      const opportunityIndex = Math.max(0, demand * roi * 100 - competition * 0.1);
      const growth = ctr > 0.03 ? 0.1 : 0;
      const decline = ctr < 0.01 ? 0.1 : 0;

      await this.prisma.regionalIntelligenceRow.upsert({
        where: { tenantId_regionId: { tenantId, regionId } },
        create: {
          tenantId,
          regionId,
          rank: 0,
          ctr,
          roi,
          avgPrice,
          avgViews,
          avgMessages: regionAds.reduce((s, a) => s + a.messages, 0) / n,
          avgSaleTime: 0,
          avgBudget: totalSpend / n,
          competition,
          demand,
          supply,
          aiScore: regionAds.reduce((s, a) => s + (a.aiScore ?? 0), 0) / n,
          marketHealth: roi > 0 ? 'healthy' : roi > -0.2 ? 'degraded' : 'unhealthy',
          growth,
          decline,
          opportunityIndex,
          updatedAt: new Date(),
        },
        update: {
          ctr,
          roi,
          avgPrice,
          avgViews,
          avgMessages: regionAds.reduce((s, a) => s + a.messages, 0) / n,
          avgBudget: totalSpend / n,
          competition,
          demand,
          supply,
          aiScore: regionAds.reduce((s, a) => s + (a.aiScore ?? 0), 0) / n,
          marketHealth: roi > 0 ? 'healthy' : roi > -0.2 ? 'degraded' : 'unhealthy',
          growth,
          decline,
          opportunityIndex,
          updatedAt: new Date(),
        },
      });

      ranked.push({ regionId, opportunityIndex });
    }

    ranked.sort((a, b) => b.opportunityIndex - a.opportunityIndex);
    for (let i = 0; i < ranked.length; i++) {
      const { regionId, opportunityIndex } = ranked[i]!;
      await this.prisma.regionalIntelligenceRow.update({
        where: { tenantId_regionId: { tenantId, regionId } },
        data: { rank: i + 1 },
      });
      await this.publisher.publish(tenantId, `regional:${tenantId}`, IntelligenceEventType.RegionalRankingUpdated, {
        regionId,
        rank: i + 1,
        opportunityIndex,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async list(tenantId: string, limit = 50) {
    return this.prisma.regionalIntelligenceRow.findMany({
      where: { tenantId },
      orderBy: { rank: 'asc' },
      take: limit,
    });
  }

  async get(tenantId: string, regionId: string) {
    return this.prisma.regionalIntelligenceRow.findUnique({
      where: { tenantId_regionId: { tenantId, regionId } },
    });
  }
}
