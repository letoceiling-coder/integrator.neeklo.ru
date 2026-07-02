import { Injectable } from '@nestjs/common';
import { Granularity, IntelligenceEventType } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricsEngine, MetricName } from '../../marketplace-core/metrics/metrics.engine';
import { IntelligenceEventPublisher } from '../events/intelligence-event.publisher';
import { HistoricalWarehouseEngine } from './historical-warehouse.engine';
import { periodBounds, type HistoricalCounters } from './granularity.utils';

export interface WarehouseMetrics {
  ctr: number;
  roi: number;
  roas: number;
  cpa: number;
  cpc: number;
  cpm: number;
  conversion: number;
  engagement: number;
  responseTime: number;
  cost: number;
  revenue: number;
  averageCheck: number;
  averageResponse: number;
  averageSaleTime: number;
  mediaScore: number;
  listingScore: number;
  aiScore: number;
  regionalScore: number;
  competitionScore: number;
  forecastScore: number;
  opportunityScore: number;
  popularityScore: number;
  views: number;
  contacts: number;
  messages: number;
  favorites: number;
}

/**
 * Metrics Warehouse — persists the full computed metrics vector per time bucket.
 * All formulas delegate to MetricsEngine; extended scores derived from counters.
 */
@Injectable()
export class MetricsWarehouseEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsEngine,
    private readonly historical: HistoricalWarehouseEngine,
    private readonly publisher: IntelligenceEventPublisher,
  ) {}

  computeFromCounters(counters: HistoricalCounters, aiScore = 0): WarehouseMetrics {
    const base = this.metrics.compute({
      views: counters.views,
      contacts: counters.contacts,
      spend: counters.spend,
      revenue: counters.revenue,
      favorites: counters.favorites,
      messages: counters.messages,
      aiScore,
    });

    const popularityScore = counters.views > 0 ? Math.min(1, (counters.favorites + counters.contacts) / counters.views) : 0;
    const listingScore = (base[MetricName.AI_SCORE] * 0.4 + base[MetricName.CTR] * 100 * 0.3 + popularityScore * 100 * 0.3) / 100;

    return {
      ctr: base[MetricName.CTR],
      roi: base[MetricName.ROI],
      roas: base[MetricName.ROAS],
      cpa: base[MetricName.CPA],
      cpc: base[MetricName.CPC],
      cpm: base[MetricName.CPM],
      conversion: base[MetricName.CONVERSION],
      engagement: base[MetricName.ENGAGEMENT],
      responseTime: base[MetricName.RESPONSE_TIME],
      cost: counters.spend,
      revenue: counters.revenue,
      averageCheck: counters.contacts > 0 ? counters.revenue / counters.contacts : 0,
      averageResponse: base[MetricName.RESPONSE_TIME],
      averageSaleTime: 0,
      mediaScore: listingScore * 0.8,
      listingScore,
      aiScore: base[MetricName.AI_SCORE],
      regionalScore: 0,
      competitionScore: 0,
      forecastScore: 0,
      opportunityScore: popularityScore * base[MetricName.ROI] * 100,
      popularityScore,
      views: counters.views,
      contacts: counters.contacts,
      messages: counters.messages,
      favorites: counters.favorites,
    };
  }

  async persistFromHistory(
    tenantId: string,
    entityType: string,
    entityId: string,
    granularity: Granularity,
    at: Date,
    counters: HistoricalCounters,
    aiScore = 0,
  ): Promise<WarehouseMetrics> {
    const { start } = periodBounds(at, granularity);
    const m = this.computeFromCounters(counters, aiScore);

    await this.prisma.metricsWarehouseRow.upsert({
      where: {
        tenantId_entityType_entityId_granularity_periodStart: {
          tenantId,
          entityType,
          entityId,
          granularity,
          periodStart: start,
        },
      },
      create: {
        tenantId,
        entityType,
        entityId,
        granularity,
        periodStart: start,
        ...this.toRow(m),
        computedAt: new Date(),
      },
      update: { ...this.toRow(m), computedAt: new Date() },
    });

    await this.publisher.publish(
      tenantId,
      this.publisher.streamKey(tenantId, entityType, entityId),
      IntelligenceEventType.MetricsWarehouseUpdated,
      {
        entityType,
        entityId,
        granularity,
        periodStart: start.toISOString(),
        updatedAt: new Date().toISOString(),
      },
    );

    return m;
  }

  async syncFromHistorical(
    tenantId: string,
    entityType: string,
    entityId: string,
    granularity: Granularity = Granularity.DAY,
  ): Promise<WarehouseMetrics | null> {
    const history = await this.historical.getHistory(tenantId, entityType, entityId, granularity, 1);
    const latest = history[0];
    if (!latest) return null;
    return this.persistFromHistory(tenantId, entityType, entityId, granularity, latest.periodStart, latest.counters);
  }

  async query(
    tenantId: string,
    entityType: string,
    entityId: string,
    granularity: Granularity,
    limit = 30,
  ) {
    return this.prisma.metricsWarehouseRow.findMany({
      where: { tenantId, entityType, entityId, granularity },
      orderBy: { periodStart: 'desc' },
      take: limit,
    });
  }

  private toRow(m: WarehouseMetrics) {
    return {
      ctr: m.ctr,
      roi: m.roi,
      roas: m.roas,
      cpa: m.cpa,
      cpc: m.cpc,
      cpm: m.cpm,
      conversion: m.conversion,
      engagement: m.engagement,
      responseTime: m.responseTime,
      cost: m.cost,
      revenue: m.revenue,
      averageCheck: m.averageCheck,
      averageResponse: m.averageResponse,
      averageSaleTime: m.averageSaleTime,
      mediaScore: m.mediaScore,
      listingScore: m.listingScore,
      aiScore: m.aiScore,
      regionalScore: m.regionalScore,
      competitionScore: m.competitionScore,
      forecastScore: m.forecastScore,
      opportunityScore: m.opportunityScore,
      popularityScore: m.popularityScore,
      views: m.views,
      contacts: m.contacts,
      messages: m.messages,
      favorites: m.favorites,
    };
  }
}
