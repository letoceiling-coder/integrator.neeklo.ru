import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, EVENT_STORE, EventSourcedRepository, type EventBus, type EventStore } from '@neeklo/kernel';
import { DealAggregate } from './deal.aggregate';

@Injectable()
export class DealRepository extends EventSourcedRepository<DealAggregate> {
  constructor(@Inject(EVENT_STORE) store: EventStore, @Inject(EVENT_BUS) bus: EventBus) {
    super(store, bus);
  }

  protected get aggregateType(): string {
    return 'deal';
  }

  protected instantiate(id: string): DealAggregate {
    return new DealAggregate(id);
  }
}
