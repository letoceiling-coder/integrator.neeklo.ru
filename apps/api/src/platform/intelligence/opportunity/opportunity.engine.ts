import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { IntelligenceEventType } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelligenceEventPublisher } from '../events/intelligence-event.publisher';
import { RegionalIntelligenceEngine } from '../regional/regional-intelligence.engine';
import { MetricsWarehouseEngine } from '../warehouse/metrics-warehouse.engine';

/**
 * Opportunity Engine — discovers high-value opportunities from regional + metrics intelligence.
 */
@Injectable()
export class OpportunityEngine {
  private readonly logger = new Logger(OpportunityEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: IntelligenceEventPublisher,
    private readonly regional: RegionalIntelligenceEngine,
    private readonly metricsWarehouse: MetricsWarehouseEngine,
  ) {}

  async scan(tenantId: string): Promise<{ detected: number }> {
    await this.regional.refresh(tenantId);
    const regions = await this.regional.list(tenantId);
    let detected = 0;

    for (const region of regions) {
      if (region.opportunityIndex > 50) {
        await this.record(tenantId, 'high_conversion_region', 'region', region.regionId, region.opportunityIndex, `Регион ${region.regionId}: высокий opportunity index (${region.opportunityIndex.toFixed(1)})`);
        detected++;
      }
      if (region.competition < 2 && region.demand > 0.05) {
        await this.record(tenantId, 'low_competition', 'region', region.regionId, region.demand * 100, `Низкая конкуренция при спросе в регионе ${region.regionId}`);
        detected++;
      }
    }

    const ads = await this.prisma.adReadModel.findMany({ where: { tenantId, status: 'active' } });
    for (const ad of ads) {
      const metrics = await this.metricsWarehouse.syncFromHistorical(tenantId, 'ad', ad.id);
      if (!metrics) continue;

      if (metrics.roi > 0.5 && metrics.cost < ad.spendAmount) {
        await this.record(tenantId, 'high_roi', 'ad', ad.id, metrics.roi * 100, `Высокий ROI (${(metrics.roi * 100).toFixed(0)}%) — недоиспользованный потенциал`);
        detected++;
      }
      if (metrics.opportunityScore > 60 && metrics.ctr < 0.03) {
        await this.record(tenantId, 'undervalued_listing', 'ad', ad.id, metrics.opportunityScore, 'Недооценённое объявление — высокий opportunity при низком CTR');
        detected++;
      }
    }

    const totalSpend = ads.reduce((s, a) => s + a.spendAmount, 0);
    const totalBudget = await this.prisma.organizationReadModel.findUnique({ where: { tenantId } });
    if (totalBudget && totalBudget.budgetTotal > totalSpend * 2) {
      await this.record(tenantId, 'unused_budget', 'organization', tenantId, 70, 'Бюджет используется менее чем на 50%');
      detected++;
    }

    return { detected };
  }

  async listOpen(tenantId: string) {
    return this.prisma.opportunityReadModel.findMany({
      where: { tenantId, status: 'open' },
      orderBy: { score: 'desc' },
      take: 50,
    });
  }

  private async record(
    tenantId: string,
    kind: string,
    entityType: string,
    entityId: string,
    score: number,
    reason: string,
  ): Promise<void> {
    const id = uuid();
    await this.prisma.opportunityReadModel.create({
      data: {
        id,
        tenantId,
        kind,
        entityType,
        entityId,
        score,
        reason,
        status: 'open',
        detectedAt: new Date(),
      },
    });

    await this.publisher.publish(tenantId, `opportunities:${tenantId}`, IntelligenceEventType.OpportunityDetected, {
      kind,
      entityType,
      entityId,
      score,
      reason,
      payload: {},
      detectedAt: new Date().toISOString(),
    });
  }
}
