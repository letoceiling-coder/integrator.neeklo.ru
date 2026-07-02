import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, EVENT_STORE, EventSourcedRepository, type EventBus, type EventStore } from '@neeklo/kernel';
import { ConversationAggregate } from './conversation.aggregate';

@Injectable()
export class ConversationRepository extends EventSourcedRepository<ConversationAggregate> {
  constructor(
    @Inject(EVENT_STORE) store: EventStore,
    @Inject(EVENT_BUS) bus: EventBus,
  ) {
    super(store, bus);
  }

  protected get aggregateType(): string {
    return 'conversation';
  }

  protected instantiate(id: string): ConversationAggregate {
    return new ConversationAggregate(id);
  }
}
