import type { RecordedEvent } from '../event-sourcing/aggregate-root';

export interface AggregateSnapshot {
  aggregateType: string;
  aggregateId: string;
  /** Stream version this snapshot represents (inclusive). */
  streamVersion: number;
  /** Snapshot schema version for migrations. */
  schemaVersion: number;
  state: Record<string, unknown>;
  createdAt: string;
}

export interface SnapshotStore {
  save(snapshot: AggregateSnapshot): Promise<void>;
  loadLatest(aggregateType: string, aggregateId: string): Promise<AggregateSnapshot | null>;
  deleteOlderThan(aggregateType: string, aggregateId: string, keepVersion: number): Promise<number>;
}

export interface SnapshotPolicy {
  /** Take a snapshot every N events on the stream. */
  intervalEvents: number;
  /** Minimum events before first snapshot. */
  minEvents: number;
}

export const SNAPSHOT_STORE = Symbol('SNAPSHOT_STORE');
export const SNAPSHOT_POLICY = Symbol('SNAPSHOT_POLICY');

/** Aggregate that can serialize/deserialize its state for snapshots. */
export interface SnapshotCapable {
  toSnapshot(): Record<string, unknown>;
  fromSnapshot(state: Record<string, unknown>): void;
}

export interface SnapshotRepositoryOptions {
  /** Rebuild from snapshot + events after this version. */
  loadWithSnapshot(
    aggregateType: string,
    aggregateId: string,
    instantiate: (id: string) => SnapshotCapable & { loadFromHistory(events: readonly RecordedEvent[]): unknown },
  ): Promise<(SnapshotCapable & { version: number }) | null>;
}
