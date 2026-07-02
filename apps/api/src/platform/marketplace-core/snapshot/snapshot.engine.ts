import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AggregateSnapshot, SnapshotStore } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_POLICY = { intervalEvents: 100, minEvents: 50 };

/**
 * Persists aggregate snapshots in Postgres. Enables fast replay: load snapshot +
 * events since snapshot version instead of full stream replay.
 */
@Injectable()
export class SnapshotStoreService implements SnapshotStore {
  constructor(private readonly prisma: PrismaService) {}

  async save(snapshot: AggregateSnapshot): Promise<void> {
    await this.prisma.aggregateSnapshot.create({
      data: {
        aggregateType: snapshot.aggregateType,
        aggregateId: snapshot.aggregateId,
        streamVersion: snapshot.streamVersion,
        schemaVersion: snapshot.schemaVersion,
        state: snapshot.state as Prisma.InputJsonValue,
        createdAt: new Date(snapshot.createdAt),
      },
    });
  }

  async loadLatest(aggregateType: string, aggregateId: string): Promise<AggregateSnapshot | null> {
    const row = await this.prisma.aggregateSnapshot.findFirst({
      where: { aggregateType, aggregateId },
      orderBy: { streamVersion: 'desc' },
    });
    if (!row) return null;
    return {
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      streamVersion: row.streamVersion,
      schemaVersion: row.schemaVersion,
      state: row.state as Record<string, unknown>,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async deleteOlderThan(aggregateType: string, aggregateId: string, keepVersion: number): Promise<number> {
    const result = await this.prisma.aggregateSnapshot.deleteMany({
      where: { aggregateType, aggregateId, streamVersion: { lt: keepVersion } },
    });
    return result.count;
  }
}

/**
 * Decides when to snapshot and executes snapshot creation after append.
 */
@Injectable()
export class SnapshotEngine {
  constructor(
    private readonly snapshotStore: SnapshotStoreService,
    private readonly prisma: PrismaService,
  ) {}

  get policy() {
    return DEFAULT_POLICY;
  }

  /** Call after events are appended; creates snapshot if interval threshold met. */
  async maybeSnapshot(
    aggregateType: string,
    aggregateId: string,
    streamVersion: number,
    state: Record<string, unknown>,
    schemaVersion = 1,
  ): Promise<void> {
    if (streamVersion < DEFAULT_POLICY.minEvents) return;
    if ((streamVersion + 1) % DEFAULT_POLICY.intervalEvents !== 0) return;

    await this.snapshotStore.save({
      aggregateType,
      aggregateId,
      streamVersion,
      schemaVersion,
      state,
      createdAt: new Date().toISOString(),
    });

    await this.snapshotStore.deleteOlderThan(aggregateType, aggregateId, streamVersion - DEFAULT_POLICY.intervalEvents);
  }

  /** Load aggregate state starting point for replay optimization. */
  async getReplayFromVersion(aggregateType: string, aggregateId: string): Promise<{
    snapshot: AggregateSnapshot | null;
    fromVersion: number;
  }> {
    const snapshot = await this.snapshotStore.loadLatest(aggregateType, aggregateId);
    return {
      snapshot,
      fromVersion: snapshot ? snapshot.streamVersion + 1 : 0,
    };
  }
}
