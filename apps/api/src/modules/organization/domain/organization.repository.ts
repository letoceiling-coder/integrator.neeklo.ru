import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, EVENT_STORE, EventSourcedRepository, type AppendContext, type EventBus, type EventStore } from '@neeklo/kernel';
import { SnapshotEngine } from '../../../platform/marketplace-core/snapshot/snapshot.engine';
import { OrganizationAggregate } from './organization.aggregate';

@Injectable()
export class OrganizationRepository extends EventSourcedRepository<OrganizationAggregate> {
  constructor(
    @Inject(EVENT_STORE) store: EventStore,
    @Inject(EVENT_BUS) bus: EventBus,
    private readonly snapshots: SnapshotEngine,
  ) {
    super(store, bus);
  }

  protected get aggregateType(): string {
    return 'organization';
  }

  protected instantiate(id: string): OrganizationAggregate {
    return new OrganizationAggregate(id);
  }

  override async save(aggregate: OrganizationAggregate, ctx: AppendContext): Promise<void> {
    await super.save(aggregate, ctx);
    await this.snapshots.maybeSnapshot(
      this.aggregateType,
      aggregate.id,
      aggregate.version,
      aggregate.toSnapshot(),
    );
  }
}
