import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { ActorType, type EventType } from '@neeklo/contracts';
import { EVENT_BUS, EVENT_STORE, type EventBus, type EventStore, type RecordedEvent } from '@neeklo/kernel';

/**
 * Publishes intelligence domain events to the `intelligence` aggregate stream.
 * Handles optimistic concurrency by reading current stream version before append.
 */
@Injectable()
export class IntelligenceEventPublisher {
  private readonly logger = new Logger(IntelligenceEventPublisher.name);

  constructor(
    @Inject(EVENT_STORE) private readonly store: EventStore,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  async publish<K extends EventType>(
    tenantId: string,
    streamKey: string,
    type: K,
    payload: Record<string, unknown>,
    correlationId = uuid(),
  ): Promise<void> {
    const events = await this.store.readStream('intelligence', streamKey);
    const expectedVersion = events.length > 0 ? events[events.length - 1]!.streamVersion : -1;

    const recorded: RecordedEvent<K> = { type, payload } as RecordedEvent<K>;

    try {
      const stored = await this.store.append('intelligence', streamKey, [recorded], {
        tenantId,
        actor: { type: ActorType.SYSTEM, id: null },
        correlationId,
        expectedVersion,
      });
      await this.bus.publish(stored);
    } catch (e) {
      this.logger.warn(`Intelligence event ${type} append failed for ${streamKey}`, e);
    }
  }

  streamKey(tenantId: string, entityType: string, entityId: string): string {
    return `${tenantId}:${entityType}:${entityId}`;
  }
}
