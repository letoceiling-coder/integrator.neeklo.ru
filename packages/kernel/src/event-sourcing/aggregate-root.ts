import type { EventPayloadMap, EventType } from '@neeklo/contracts';

/** An event as produced/consumed inside the domain, before/after envelope enrichment. */
export interface RecordedEvent<K extends EventType = EventType> {
  type: K;
  payload: EventPayloadMap[K];
}

/**
 * Base class for event-sourced aggregates.
 *
 * State is never mutated directly — it is derived by folding events. Behaviour methods
 * validate invariants then `raise()` a fact; the same reducer runs both for new events and
 * when replaying history, guaranteeing "current state == fold(history)".
 */
export abstract class AggregateRoot {
  private _uncommitted: RecordedEvent[] = [];
  private _version = -1; // -1 => empty stream; first event lands at version 0

  constructor(public readonly id: string) {}

  abstract get aggregateType(): string;

  /** Last persisted (or replayed) stream version. */
  get version(): number {
    return this._version;
  }

  get hasUncommitted(): boolean {
    return this._uncommitted.length > 0;
  }

  /** Reducer: mutate in-memory state for a single event. Must be pure & deterministic. */
  protected abstract apply(event: RecordedEvent): void;

  /** Emit a new domain fact: fold it into state and stage it for persistence. */
  protected raise<K extends EventType>(type: K, payload: EventPayloadMap[K]): void {
    const event: RecordedEvent<K> = { type, payload };
    this.apply(event);
    this._version += 1;
    this._uncommitted.push(event);
  }

  /** Rebuild state by replaying persisted events. No events are staged. */
  loadFromHistory(events: readonly RecordedEvent[]): this {
    for (const event of events) {
      this.apply(event);
      this._version += 1;
    }
    return this;
  }

  /** Drain staged events (called by the repository right before append). */
  pullUncommitted(): RecordedEvent[] {
    const drained = this._uncommitted;
    this._uncommitted = [];
    return drained;
  }
}
