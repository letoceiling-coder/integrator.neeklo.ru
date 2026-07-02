import type { Prisma } from '@prisma/client';
import type { EventType } from '@neeklo/contracts';
import type { StoredEvent } from '@neeklo/kernel';

export type ProjectionTx = Prisma.TransactionClient;

/**
 * A read-model projection. The manager feeds it the global event log strictly in order,
 * exactly once, advancing a per-projection checkpoint in the same transaction as the write —
 * so read models can always be dropped and deterministically rebuilt from events.
 */
export interface Projection {
  /** Unique name; also the checkpoint key. */
  readonly name: string;
  /** Only events of these types are delivered. */
  readonly handles: ReadonlySet<EventType>;
  project(event: StoredEvent, tx: ProjectionTx): Promise<void>;
}

export const PROJECTION = Symbol('PROJECTION');
