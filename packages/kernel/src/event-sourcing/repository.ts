import { AggregateRoot } from './aggregate-root';
import type { AppendContext, EventBus, EventStore } from './ports';

/**
 * Generic event-sourced repository. Concrete repos only declare how to construct an
 * empty aggregate; loading (replay) and saving (append + publish) are handled here.
 */
export abstract class EventSourcedRepository<A extends AggregateRoot> {
  protected constructor(
    protected readonly store: EventStore,
    protected readonly bus: EventBus,
  ) {}

  protected abstract get aggregateType(): string;
  /** Build a fresh, empty aggregate instance for the given id. */
  protected abstract instantiate(id: string): A;

  async load(id: string): Promise<A | null> {
    const events = await this.store.readStream(this.aggregateType, id);
    if (events.length === 0) return null;
    const aggregate = this.instantiate(id);
    aggregate.loadFromHistory(events.map((e) => ({ type: e.type, payload: e.payload })));
    return aggregate;
  }

  /** Persist staged events with optimistic concurrency, then publish them to the bus. */
  async save(aggregate: A, ctx: AppendContext): Promise<void> {
    const uncommitted = aggregate.pullUncommitted();
    if (uncommitted.length === 0) return;
    const expectedVersion = aggregate.version - uncommitted.length;
    const stored = await this.store.append(this.aggregateType, aggregate.id, uncommitted, {
      ...ctx,
      expectedVersion,
    });
    await this.bus.publish(stored);
  }
}
