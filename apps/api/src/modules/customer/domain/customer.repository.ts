import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, EVENT_STORE, EventSourcedRepository, type EventBus, type EventStore } from '@neeklo/kernel';
import { CustomerAggregate } from './customer.aggregate';

@Injectable()
export class CustomerRepository extends EventSourcedRepository<CustomerAggregate> {
  constructor(@Inject(EVENT_STORE) store: EventStore, @Inject(EVENT_BUS) bus: EventBus) {
    super(store, bus);
  }

  protected get aggregateType(): string {
    return 'customer';
  }

  protected instantiate(id: string): CustomerAggregate {
    return new CustomerAggregate(id);
  }
}
