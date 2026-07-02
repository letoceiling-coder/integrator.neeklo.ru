import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, EVENT_STORE, EventSourcedRepository, type EventBus, type EventStore } from '@neeklo/kernel';
import { MarketplaceAggregate } from './marketplace.aggregate';

@Injectable()
export class MarketplaceRepository extends EventSourcedRepository<MarketplaceAggregate> {
  constructor(
    @Inject(EVENT_STORE) store: EventStore,
    @Inject(EVENT_BUS) bus: EventBus,
  ) {
    super(store, bus);
  }

  protected get aggregateType(): string {
    return 'marketplace';
  }

  protected instantiate(id: string): MarketplaceAggregate {
    return new MarketplaceAggregate(id);
  }
}
