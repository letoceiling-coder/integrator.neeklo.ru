import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, EVENT_STORE, EventSourcedRepository, type AppendContext, type EventBus, type EventStore } from '@neeklo/kernel';
import { SnapshotEngine } from '../../../platform/marketplace-core/snapshot/snapshot.engine';
import { AccountAggregate } from './account.aggregate';

@Injectable()
export class AccountRepository extends EventSourcedRepository<AccountAggregate> {
  constructor(
    @Inject(EVENT_STORE) store: EventStore,
    @Inject(EVENT_BUS) bus: EventBus,
    private readonly snapshots: SnapshotEngine,
  ) {
    super(store, bus);
  }

  protected get aggregateType(): string {
    return 'account';
  }

  protected instantiate(id: string): AccountAggregate {
    return new AccountAggregate(id);
  }

  override async save(aggregate: AccountAggregate, ctx: AppendContext): Promise<void> {
    await super.save(aggregate, ctx);
    await this.snapshots.maybeSnapshot(
      this.aggregateType,
      aggregate.id,
      aggregate.version,
      aggregate.toSnapshot(),
    );
  }
}
