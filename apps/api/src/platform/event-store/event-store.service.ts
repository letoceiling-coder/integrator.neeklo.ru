import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import {
  aggregateTypeOf,
  isEventType,
  parseEventPayload,
  type EventType,
} from '@neeklo/contracts';
import {
  ConcurrencyError,
  type AppendContext,
  type EventStore,
  type RecordedEvent,
  type StoredEvent,
} from '@neeklo/kernel';
import { PrismaService } from '../prisma/prisma.service';

type EventRow = {
  globalPosition: bigint;
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  streamVersion: number;
  type: string;
  tenantId: string;
  actorType: string;
  actorId: string | null;
  correlationId: string;
  causationId: string | null;
  occurredAt: Date;
  payload: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
};

/**
 * Append-only Postgres event store. Optimistic concurrency is enforced by the
 * `(aggregate_type, aggregate_id, stream_version)` unique index — a conflicting append
 * throws {@link ConcurrencyError} so the caller can reload and retry.
 */
@Injectable()
export class EventStoreService implements EventStore {
  private readonly logger = new Logger(EventStoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  async append(
    aggregateType: string,
    aggregateId: string,
    events: readonly RecordedEvent[],
    ctx: AppendContext & { expectedVersion: number },
  ): Promise<StoredEvent[]> {
    if (events.length === 0) return [];
    const occurredAt = new Date().toISOString();

    const rows = events.map((event, i) => {
      // Validate every payload against the catalog before it becomes an immutable fact.
      const payload = parseEventPayload(event.type, event.payload);
      return {
        eventId: uuid(),
        aggregateType,
        aggregateId,
        streamVersion: ctx.expectedVersion + 1 + i,
        type: event.type,
        tenantId: ctx.tenantId,
        actorType: ctx.actor.type,
        actorId: ctx.actor.id,
        correlationId: ctx.correlationId,
        causationId: ctx.causationId ?? null,
        occurredAt: new Date(occurredAt),
        payload: payload as Prisma.InputJsonValue,
        metadata: (ctx.metadata ?? {}) as Prisma.InputJsonValue,
      };
    });

    try {
      const created = await this.prisma.$transaction(
        rows.map((data) =>
          this.prisma.eventStore.create({
            data,
            select: EVENT_SELECT,
          }),
        ),
      );
      return created.map((r) => this.toStoredEvent(r));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Someone appended to this stream concurrently.
        const current = await this.currentVersion(aggregateType, aggregateId);
        throw new ConcurrencyError(ctx.expectedVersion, current);
      }
      throw e;
    }
  }

  async readStream(
    aggregateType: string,
    aggregateId: string,
    fromVersion = 0,
  ): Promise<StoredEvent[]> {
    const rows = await this.prisma.eventStore.findMany({
      where: { aggregateType, aggregateId, streamVersion: { gte: fromVersion } },
      orderBy: { streamVersion: 'asc' },
      select: EVENT_SELECT,
    });
    return rows.map((r) => this.toStoredEvent(r));
  }

  async readAll(fromGlobalPosition: string | null = null, limit = 500): Promise<StoredEvent[]> {
    const rows = await this.prisma.eventStore.findMany({
      where: fromGlobalPosition ? { globalPosition: { gt: BigInt(fromGlobalPosition) } } : undefined,
      orderBy: { globalPosition: 'asc' },
      take: limit,
      select: EVENT_SELECT,
    });
    return rows.map((r) => this.toStoredEvent(r));
  }

  private async currentVersion(aggregateType: string, aggregateId: string): Promise<number> {
    const last = await this.prisma.eventStore.findFirst({
      where: { aggregateType, aggregateId },
      orderBy: { streamVersion: 'desc' },
      select: { streamVersion: true },
    });
    return last?.streamVersion ?? -1;
  }

  private toStoredEvent(row: EventRow): StoredEvent {
    if (!isEventType(row.type)) {
      this.logger.warn(`Unknown event type "${row.type}" at position ${row.globalPosition}`);
    }
    return {
      eventId: row.eventId,
      streamVersion: row.streamVersion,
      globalPosition: row.globalPosition.toString(),
      type: row.type as EventType,
      aggregateType: row.aggregateType || aggregateTypeOf(row.type as EventType),
      aggregateId: row.aggregateId,
      tenantId: row.tenantId,
      actor: { type: row.actorType as never, id: row.actorId },
      correlationId: row.correlationId,
      causationId: row.causationId,
      occurredAt: row.occurredAt.toISOString(),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      payload: (row.payload ?? {}) as Record<string, unknown>,
    };
  }
}

const EVENT_SELECT = {
  globalPosition: true,
  eventId: true,
  aggregateType: true,
  aggregateId: true,
  streamVersion: true,
  type: true,
  tenantId: true,
  actorType: true,
  actorId: true,
  correlationId: true,
  causationId: true,
  occurredAt: true,
  payload: true,
  metadata: true,
} satisfies Prisma.EventStoreSelect;
