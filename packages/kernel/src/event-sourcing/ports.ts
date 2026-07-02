import type { Actor, EventEnvelope, EventPayloadMap, EventType } from '@neeklo/contracts';
import type { RecordedEvent } from './aggregate-root';

/** A fully-enriched, persisted event as it comes back from the store / bus. */
export interface StoredEvent<K extends EventType = EventType>
  extends EventEnvelope<EventPayloadMap[K]> {
  type: K;
}

export interface AppendContext {
  tenantId: string;
  actor: Actor;
  correlationId: string;
  causationId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only event store port. Implemented over Postgres in the API.
 * `expectedVersion` enforces optimistic concurrency (-1 == the stream must not yet exist).
 */
export interface EventStore {
  append(
    aggregateType: string,
    aggregateId: string,
    events: readonly RecordedEvent[],
    ctx: AppendContext & { expectedVersion: number },
  ): Promise<StoredEvent[]>;

  readStream(
    aggregateType: string,
    aggregateId: string,
    fromVersion?: number,
  ): Promise<StoredEvent[]>;

  /** Global, ordered feed for projections/catch-up subscriptions. */
  readAll(fromGlobalPosition?: string | null, limit?: number): Promise<StoredEvent[]>;
}

export type EventHandler = (event: StoredEvent) => Promise<void> | void;

export interface Subscription {
  unsubscribe(): Promise<void>;
}

export interface SubscribeOptions {
  /** Restrict delivery to these event types. */
  types?: EventType[];
  /** Consumer group name (competing consumers get load-balanced delivery). */
  group?: string;
  /** Stable consumer name within the group. */
  consumer?: string;
}

/**
 * Durable, replayable event bus port. Implemented over Redis Streams in the API so that
 * new modules (analytics, recommendations, automations) simply subscribe to the fact stream.
 */
export interface EventBus {
  publish(events: readonly StoredEvent[]): Promise<void>;
  subscribe(handler: EventHandler, opts?: SubscribeOptions): Promise<Subscription>;
}

/** DI tokens (NestJS resolves the concrete adapters against these). */
export const EVENT_STORE = Symbol('EVENT_STORE');
export const EVENT_BUS = Symbol('EVENT_BUS');
