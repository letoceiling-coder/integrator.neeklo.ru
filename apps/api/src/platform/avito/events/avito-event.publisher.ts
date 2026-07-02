import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AvitoEventType } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { EVENT_BUS, EVENT_STORE, type EventBus, type EventStore } from '@neeklo/kernel';

@Injectable()
export class AvitoEventPublisher {
  constructor(
    @Inject(EVENT_STORE) private readonly store: EventStore,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  async publish(
    tenantId: string,
    streamKey: string,
    type: AvitoEventType,
    payload: Record<string, unknown>,
    ctx?: AppendContext,
  ): Promise<void> {
    const events = await this.store.readStream('avito', streamKey);
    const expectedVersion = events.length > 0 ? events[events.length - 1]!.streamVersion : -1;
    const stored = await this.store.append('avito', streamKey, [{ type, payload }], {
      tenantId,
      actor: ctx?.actor ?? { type: 'system', id: null },
      correlationId: ctx?.correlationId ?? uuid(),
      expectedVersion,
    });
    await this.bus.publish(stored);
  }
}
