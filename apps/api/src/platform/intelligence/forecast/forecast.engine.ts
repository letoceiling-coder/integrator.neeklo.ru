import { Inject, Injectable } from '@nestjs/common';
import { Granularity, IntelligenceEventType } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { HistoricalWarehouseEngine } from '../warehouse/historical-warehouse.engine';
import { IntelligenceEventPublisher } from '../events/intelligence-event.publisher';
import {
  FORECAST_PROVIDER,
  type ForecastProvider,
  type ForecastResult,
} from './forecast.provider';

@Injectable()
export class ForecastEngine {
  constructor(
    @Inject(FORECAST_PROVIDER) private readonly provider: ForecastProvider,
    private readonly historical: HistoricalWarehouseEngine,
    private readonly publisher: IntelligenceEventPublisher,
    private readonly prisma: PrismaService,
  ) {}

  async forecast(
    tenantId: string,
    entityType: string,
    entityId: string,
    horizonDays = 7,
    granularity: Granularity = Granularity.DAY,
  ): Promise<ForecastResult> {
    const history = await this.historical.getHistory(tenantId, entityType, entityId, granularity, 60);

    const metrics = ['views', 'contacts', 'revenue', 'spend'] as const;
    const series = metrics.map((metric) => ({
      metric,
      history: history.map((h) => ({
        periodStart: h.periodStart.toISOString(),
        value: (h.counters as Record<string, number>)[metric] ?? 0,
      })),
    }));

    const result = await this.provider.predict({
      tenantId,
      entityType,
      entityId,
      horizonDays,
      series,
    });

    await this.prisma.forecastSnapshot.create({
      data: {
        tenantId,
        entityType,
        entityId,
        horizonDays,
        algorithm: result.algorithm,
        forecasts: result.forecasts,
        generatedAt: new Date(result.generatedAt),
      },
    });

    await this.publisher.publish(
      tenantId,
      this.publisher.streamKey(tenantId, entityType, entityId),
      IntelligenceEventType.ForecastGenerated,
      {
        entityType,
        entityId,
        horizonDays,
        algorithm: result.algorithm,
        forecasts: result.forecasts,
        generatedAt: result.generatedAt,
      },
    );

    return result;
  }

  async getLatest(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.forecastSnapshot.findFirst({
      where: { tenantId, entityType, entityId },
      orderBy: { generatedAt: 'desc' },
    });
  }
}
