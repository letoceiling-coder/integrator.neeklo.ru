import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, EVENT_STORE, EventSourcedRepository, type EventBus, type EventStore } from '@neeklo/kernel';
import { AdAggregate } from './ad.aggregate';

@Injectable()
export class AdRepository extends EventSourcedRepository<AdAggregate> {
  constructor(
    @Inject(EVENT_STORE) store: EventStore,
    @Inject(EVENT_BUS) bus: EventBus,
  ) {
    super(store, bus);
  }

  protected get aggregateType(): string {
    return 'ad';
  }

  protected instantiate(id: string): AdAggregate {
    return new AdAggregate(id);
  }
}
