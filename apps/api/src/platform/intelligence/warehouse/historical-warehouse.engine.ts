import { Injectable, Logger } from '@nestjs/common';
import { EventType, Granularity, IntelligenceEventType } from '@neeklo/contracts';
import type { StoredEvent } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelligenceEventPublisher } from '../events/intelligence-event.publisher';
import {
  EMPTY_COUNTERS,
  mergeCounters,
  periodBounds,
  ROLLUP_CHAIN,
  type HistoricalCounters,
} from './granularity.utils';

/**
 * Historical Data Warehouse — aggregated time-series counters.
 * Event Store remains the source of truth; this layer is for analytics/forecasting only.
 */
@Injectable()
export class HistoricalWarehouseEngine {
  private readonly logger = new Logger(HistoricalWarehouseEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: IntelligenceEventPublisher,
  ) {}

  /** Ingest a domain event into the current hourly bucket. */
  async ingestEvent(event: StoredEvent): Promise<void> {
    const delta = this.deltaFromEvent(event);
    if (!delta) return;

    const at = new Date(event.occurredAt);
    await this.increment(event.tenantId, 'ad', event.aggregateId, Granularity.HOUR, at, delta, {
      eventType: event.type,
    });

    await this.cascadeRollups(event.tenantId, 'ad', event.aggregateId, Granularity.HOUR, at);
  }

  private deltaFromEvent(event: StoredEvent): Partial<HistoricalCounters> | null {
    switch (event.type) {
      case EventType.ViewRecorded:
        return { views: (event.payload as { count?: number }).count ?? 1, events: 1 };
      case EventType.ContactRecorded:
        return { contacts: 1, events: 1 };
      case EventType.FavoriteAdded:
        return { favorites: 1, events: 1 };
      case EventType.MessageReceived:
        return { messages: 1, events: 1 };
      case EventType.BudgetSpent:
        return { spend: (event.payload as { amount: { amount: number } }).amount.amount, events: 1 };
      case EventType.AdSold:
        return { revenue: (event.payload as { price: { amount: number } }).price.amount, events: 1 };
      default:
        return null;
    }
  }

  async increment(
    tenantId: string,
    entityType: string,
    entityId: string,
    granularity: Granularity,
    at: Date,
    delta: Partial<HistoricalCounters>,
    dimensions: Record<string, string> = {},
  ): Promise<void> {
    const { start, end } = periodBounds(at, granularity);
    const existing = await this.prisma.historicalAggregate.findUnique({
      where: {
        tenantId_entityType_entityId_granularity_periodStart: {
          tenantId,
          entityType,
          entityId,
          granularity,
          periodStart: start,
        },
      },
    });

    const counters = mergeCounters(
      (existing?.counters as HistoricalCounters) ?? EMPTY_COUNTERS,
      delta,
    );

    await this.prisma.historicalAggregate.upsert({
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
        periodEnd: end,
        counters,
        dimensions,
        computedAt: new Date(),
      },
      update: { counters, dimensions, computedAt: new Date() },
    });
  }

  async getHistory(
    tenantId: string,
    entityType: string,
    entityId: string,
    granularity: Granularity,
    limit = 90,
  ): Promise<{ periodStart: Date; counters: HistoricalCounters }[]> {
    const rows = await this.prisma.historicalAggregate.findMany({
      where: { tenantId, entityType, entityId, granularity },
      orderBy: { periodStart: 'desc' },
      take: limit,
    });
    return rows
      .map((r) => ({ periodStart: r.periodStart, counters: r.counters as HistoricalCounters }))
      .reverse();
  }

  private async cascadeRollups(
    tenantId: string,
    entityType: string,
    entityId: string,
    fromGranularity: Granularity,
    at: Date,
  ): Promise<void> {
    const next = ROLLUP_CHAIN[fromGranularity];
    if (!next) return;

    const { start } = periodBounds(at, next);
    const childGranularity = fromGranularity;
    const childRows = await this.prisma.historicalAggregate.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
        granularity: childGranularity,
        periodStart: { gte: start, lt: periodBounds(at, next).end },
      },
    });

    let rolled = EMPTY_COUNTERS;
    for (const row of childRows) {
      rolled = mergeCounters(rolled, row.counters as HistoricalCounters);
    }

    await this.prisma.historicalAggregate.upsert({
      where: {
        tenantId_entityType_entityId_granularity_periodStart: {
          tenantId,
          entityType,
          entityId,
          granularity: next,
          periodStart: start,
        },
      },
      create: {
        tenantId,
        entityType,
        entityId,
        granularity: next,
        periodStart: start,
        periodEnd: periodBounds(at, next).end,
        counters: rolled,
        dimensions: {},
        computedAt: new Date(),
      },
      update: { counters: rolled, computedAt: new Date() },
    });

    await this.emitRollupEvent(tenantId, entityType, entityId, childGranularity, next, start);
    await this.cascadeRollups(tenantId, entityType, entityId, next, at);
  }

  private async emitRollupEvent(
    tenantId: string,
    entityType: string,
    entityId: string,
    from: Granularity,
    to: Granularity,
    periodStart: Date,
  ): Promise<void> {
    await this.publisher.publish(
      tenantId,
      this.publisher.streamKey(tenantId, entityType, entityId),
      IntelligenceEventType.HistoricalRollupCompleted,
      {
        entityType,
        entityId,
        fromGranularity: from,
        toGranularity: to,
        periodStart: periodStart.toISOString(),
        completedAt: new Date().toISOString(),
      },
    );
  }
}
