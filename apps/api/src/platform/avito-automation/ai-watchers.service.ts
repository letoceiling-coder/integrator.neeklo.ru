import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { AvitoAiWatcherCreateDto, AvitoAiWatcherDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastEngine } from '../intelligence/forecast/forecast.engine';
import { MetricsWarehouseEngine } from '../intelligence/warehouse/metrics-warehouse.engine';
import { AvitoObservatoryService } from './ai-observatory.service';

type WatcherRow = {
  id: string;
  name: string;
  metric: string;
  entityType: string;
  entityId: string | null;
  enabled: boolean;
  compareDays: number;
  anomalyThresholdPct: number;
  lastRunAt: Date | null;
  lastStatus: string | null;
  lastValue: number | null;
  lastForecast: string | null;
  recommendation: string | null;
};

@Injectable()
export class AiWatchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastEngine,
    private readonly metrics: MetricsWarehouseEngine,
    private readonly observatory: AvitoObservatoryService,
  ) {}

  async list(tenantId: string): Promise<AvitoAiWatcherDto[]> {
    const rows = await this.prisma.avitoAiWatcherReadModel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(tenantId: string, dto: AvitoAiWatcherCreateDto): Promise<AvitoAiWatcherDto> {
    const row = await this.prisma.avitoAiWatcherReadModel.create({
      data: {
        id: uuid(),
        tenantId,
        name: dto.name,
        metric: dto.metric,
        entityType: dto.entityType ?? 'organization',
        entityId: dto.entityId ?? null,
        enabled: dto.enabled ?? true,
        compareDays: dto.compareDays ?? 7,
        anomalyThresholdPct: dto.anomalyThresholdPct ?? 30,
        createdAt: new Date(),
      },
    });
    return this.toDto(row);
  }

  async evaluateAll(tenantId: string): Promise<{ evaluated: number; findings: number }> {
    const watchers = await this.prisma.avitoAiWatcherReadModel.findMany({
      where: { tenantId, enabled: true },
    });
    let findings = 0;
    for (const w of watchers) {
      const result = await this.evaluateOne(tenantId, w);
      if (result.finding) findings++;
    }
    return { evaluated: watchers.length, findings };
  }

  private async evaluateOne(tenantId: string, w: WatcherRow): Promise<{ finding: boolean }> {
    const now = new Date();
    let current = 0;
    let previous = 0;
    let forecastStr: string | null = null;
    let recommendation: string | null = null;
    let status: 'ok' | 'anomaly' | 'growth' | 'decline' | 'error' = 'ok';

    try {
      const entityType = w.entityType;
      const entityId = w.entityId ?? tenantId;

      if (w.metric === 'budget') {
        const org = await this.prisma.organizationReadModel.findUnique({ where: { tenantId } });
        const ads = await this.prisma.adReadModel.findMany({ where: { tenantId } });
        current = org?.budgetTotal ?? 0;
        previous = ads.reduce((s, a) => s + a.spendAmount, 0);
      } else if (w.metric === 'region') {
        const regions = await this.prisma.regionalIntelligenceRow.findMany({ where: { tenantId }, take: 1, orderBy: { opportunityIndex: 'desc' } });
        current = regions[0]?.opportunityIndex ?? 0;
        previous = regions[0]?.ctr ?? 0;
      } else if (w.metric === 'sales') {
        const deals = await this.prisma.dealReadModel.findMany({ where: { tenantId, stage: { in: ['paid', 'completed'] } } });
        current = deals.length;
        previous = Math.max(1, deals.filter((d) => d.closedAt && d.closedAt > new Date(Date.now() - w.compareDays * 86400_000)).length);
      } else {
        const m = await this.metrics.syncFromHistorical(tenantId, entityType, entityId);
        if (m) {
          current = this.metricValue(m, w.metric);
          const ad = entityType === 'ad' ? await this.prisma.adReadModel.findFirst({ where: { id: entityId, tenantId } }) : null;
          if (ad) {
            previous = this.adMetricValue(ad, w.metric) * 0.85;
          } else {
            previous = current * 0.9;
          }
        } else if (entityType === 'ad') {
          const ad = await this.prisma.adReadModel.findFirst({ where: { id: entityId, tenantId } });
          if (ad) {
            current = this.adMetricValue(ad, w.metric);
            previous = current * 0.85;
          }
        } else {
          const ads = await this.prisma.adReadModel.findMany({ where: { tenantId } });
          current = ads.reduce((s, a) => s + this.adMetricValue(a, w.metric), 0);
          previous = current * 0.9;
        }
      }

      try {
        const f = await this.forecast.forecast(tenantId, w.entityType, entityId, w.compareDays);
        forecastStr = f.forecasts[0]?.trend ?? 'stable';
      } catch {
        forecastStr = 'stable';
      }

      const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      const threshold = w.anomalyThresholdPct;

      if (changePct <= -threshold) {
        status = 'decline';
        recommendation = `${w.metric.toUpperCase()} упал на ${Math.abs(changePct).toFixed(0)}% — проверьте объявления и продвижение`;
      } else if (changePct >= threshold) {
        status = 'growth';
        recommendation = `${w.metric.toUpperCase()} вырос на ${changePct.toFixed(0)}% — рассмотрите масштабирование`;
      } else if (Math.abs(changePct) >= threshold * 0.8) {
        status = 'anomaly';
        recommendation = `Аномалия по ${w.metric}: изменение ${changePct.toFixed(0)}%`;
      }

      if (status !== 'ok' && recommendation) {
        await this.observatory.upsertItem(tenantId, {
          kind: status === 'decline' ? 'warning' : status === 'anomaly' ? 'anomaly' : status === 'growth' ? 'opportunity' : 'forecast',
          severity: status === 'decline' || status === 'anomaly' ? 'warning' : 'info',
          title: `Watcher: ${w.name}`,
          body: recommendation,
          entityType: w.entityType,
          entityId: w.entityId,
          source: 'watcher',
          dedupeKey: `watcher:${w.id}:${status}`,
        });
      }
    } catch {
      status = 'error';
    }

    await this.prisma.avitoAiWatcherReadModel.update({
      where: { id: w.id },
      data: {
        lastRunAt: now,
        lastStatus: status,
        lastValue: current,
        lastForecast: forecastStr,
        recommendation,
      },
    });

    return { finding: status !== 'ok' };
  }

  private metricValue(m: { ctr: number; roi: number; roas: number; cpa: number; views: number; contacts: number; favorites: number; conversion: number; messages: number; cost: number }, metric: string): number {
    const map: Record<string, number> = {
      ctr: m.ctr,
      roi: m.roi,
      roas: m.roas,
      cpa: m.cpa,
      views: m.views,
      contacts: m.contacts,
      favorites: m.favorites,
      conversion: m.conversion,
      messages: m.messages,
      promotion_cost: m.cost,
    };
    return map[metric] ?? 0;
  }

  private adMetricValue(ad: { ctr: number; roi: number; views: number; contacts: number; favorites: number; messages: number; spendAmount: number; conversion: number }, metric: string): number {
    const map: Record<string, number> = {
      ctr: ad.ctr,
      roi: ad.roi,
      views: ad.views,
      contacts: ad.contacts,
      favorites: ad.favorites,
      messages: ad.messages,
      promotion_cost: ad.spendAmount,
      conversion: ad.conversion,
    };
    return map[metric] ?? 0;
  }

  private toDto(r: WatcherRow): AvitoAiWatcherDto {
    return {
      id: r.id,
      name: r.name,
      metric: r.metric as AvitoAiWatcherDto['metric'],
      entityType: r.entityType,
      entityId: r.entityId,
      enabled: r.enabled,
      compareDays: r.compareDays,
      anomalyThresholdPct: r.anomalyThresholdPct,
      lastRunAt: r.lastRunAt?.toISOString() ?? null,
      lastStatus: r.lastStatus as AvitoAiWatcherDto['lastStatus'],
      lastValue: r.lastValue,
      lastForecast: r.lastForecast,
      recommendation: r.recommendation,
    };
  }
}
