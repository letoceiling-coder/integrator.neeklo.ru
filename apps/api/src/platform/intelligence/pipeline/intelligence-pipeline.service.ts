import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { EventType, isEventType } from '@neeklo/contracts';
import { EVENT_BUS, type EventBus, type StoredEvent } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { HistoricalWarehouseEngine } from '../warehouse/historical-warehouse.engine';
import { MetricsWarehouseEngine } from '../warehouse/metrics-warehouse.engine';
import { ForecastEngine } from '../forecast/forecast.engine';
import { DecisionEngine } from '../decision/decision.engine';
import { KnowledgeGraphV2Service } from '../knowledge-graph/knowledge-graph-v2.service';
import { IntelligenceObservabilityService } from '../observability/intelligence-observability.service';

const TRIGGER_FORECAST = new Set([
  EventType.ViewRecorded,
  EventType.ContactRecorded,
  EventType.AdSold,
  EventType.BudgetSpent,
]);

/**
 * Intelligence Pipeline — orchestrates warehouse → metrics → forecast → decision flow.
 * Consumes the domain event stream independently from AnalyticsEngine.
 */
@Injectable()
export class IntelligencePipelineService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IntelligencePipelineService.name);

  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    private readonly historical: HistoricalWarehouseEngine,
    private readonly metricsWarehouse: MetricsWarehouseEngine,
    private readonly forecast: ForecastEngine,
    private readonly decision: DecisionEngine,
    private readonly knowledgeGraph: KnowledgeGraphV2Service,
    private readonly observability: IntelligenceObservabilityService,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.subscribe((event) => this.process(event), { group: 'intelligence-pipeline' });
    this.logger.log('Intelligence pipeline subscribed to event stream');
  }

  async process(event: StoredEvent): Promise<void> {
    if (!isEventType(event.type)) return;

    const traceId = event.correlationId ?? event.eventId;
    const started = Date.now();

    try {
      if (event.type.startsWith('ad.')) {
        await this.historical.ingestEvent(event);
        await this.metricsWarehouse.syncFromHistorical(event.tenantId, 'ad', event.aggregateId);
      }

      if (event.type.startsWith('intelligence.')) {
        await this.knowledgeGraph.ingestIntelligenceEvent(event);
      }

      if (event.type.startsWith('ad.') && TRIGGER_FORECAST.has(event.type as EventType)) {
        await this.forecast.forecast(event.tenantId, 'ad', event.aggregateId, 7);
        await this.decision.decide(event.tenantId, 'ad', event.aggregateId);
      }

      const position = event.globalPosition ? BigInt(event.globalPosition) : BigInt(Date.now());
      await this.prisma.intelligencePipelineCheckpoint.upsert({
        where: { pipeline: 'intelligence-pipeline' },
        create: { pipeline: 'intelligence-pipeline', position },
        update: { position },
      });

      await this.observability.recordPipelineLatency('process_event', Date.now() - started, {
        tenantId: event.tenantId,
        eventType: event.type,
        traceId,
      });
    } catch (err) {
      this.logger.error(`Intelligence pipeline failed for ${event.type}`, err instanceof Error ? err.stack : err);
      await this.observability.recordPipelineLatency('process_event_error', Date.now() - started, {
        tenantId: event.tenantId,
        eventType: event.type,
        traceId,
        status: 'error',
      });
    }
  }
}
