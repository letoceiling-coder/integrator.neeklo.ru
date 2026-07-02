import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { ActorType, AiEventType } from '@neeklo/contracts';
import { EVENT_BUS, EVENT_STORE, type EventBus, type EventStore } from '@neeklo/kernel';

/** Publishes AI platform events to the `ai` aggregate stream. */
@Injectable()
export class AiEventPublisher {
  private readonly logger = new Logger(AiEventPublisher.name);

  constructor(
    @Inject(EVENT_STORE) private readonly store: EventStore,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  async publish(
    tenantId: string,
    streamKey: string,
    type: AiEventType,
    payload: Record<string, unknown>,
    correlationId = uuid(),
  ): Promise<void> {
    const events = await this.store.readStream('ai', streamKey);
    const expectedVersion = events.length > 0 ? events[events.length - 1]!.streamVersion : -1;
    try {
      const stored = await this.store.append('ai', streamKey, [{ type, payload }], {
        tenantId,
        actor: { type: ActorType.AI, id: null },
        correlationId,
        expectedVersion,
      });
      await this.bus.publish(stored);
    } catch (e) {
      this.logger.warn(`AI event ${type} append failed for ${streamKey}`, e);
    }
  }
}
