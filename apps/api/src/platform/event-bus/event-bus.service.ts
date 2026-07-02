import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { isEventType, type EventType } from '@neeklo/contracts';
import type {
  EventBus,
  EventHandler,
  StoredEvent,
  Subscription,
  SubscribeOptions,
} from '@neeklo/kernel';
import { REDIS } from '../redis/redis.module';

const STREAM_KEY = 'neeklo:events';
const MAXLEN = 1_000_000; // capped stream; durable history always lives in Postgres.

/**
 * Durable, replayable event bus over Redis Streams.
 *
 * `publish` XADDs each event; `subscribe` joins a consumer group so competing consumers
 * (workers) share the load while independent groups (projections, analytics, automations)
 * each get the full feed. Postgres remains the source of truth — Redis is the transport.
 */
@Injectable()
export class EventBusService implements EventBus, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private readonly subscribers = new Set<{ stop: () => void }>();

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async publish(events: readonly StoredEvent[]): Promise<void> {
    if (events.length === 0) return;
    const pipeline = this.redis.pipeline();
    for (const event of events) {
      pipeline.xadd(
        STREAM_KEY,
        'MAXLEN',
        '~',
        MAXLEN,
        '*',
        'type',
        event.type,
        'tenantId',
        event.tenantId,
        'data',
        JSON.stringify(event),
      );
    }
    await pipeline.exec();
  }

  async subscribe(handler: EventHandler, opts: SubscribeOptions = {}): Promise<Subscription> {
    const group = opts.group ?? 'default';
    const consumer = opts.consumer ?? `c-${process.pid}`;
    const typeFilter = opts.types ? new Set<EventType>(opts.types) : null;

    // A dedicated blocking connection per subscriber (XREADGROUP BLOCK holds the socket).
    const conn = this.redis.duplicate();
    await this.ensureGroup(conn, group);

    let running = true;
    const loop = async (): Promise<void> => {
      while (running) {
        try {
          const res = (await conn.xreadgroup(
            'GROUP',
            group,
            consumer,
            'COUNT',
            50,
            'BLOCK',
            5000,
            'STREAMS',
            STREAM_KEY,
            '>',
          )) as [string, [string, string[]][]][] | null;

          if (!res) continue;
          for (const [, entries] of res) {
            for (const [id, fields] of entries) {
              const event = this.decode(fields);
              try {
                if (event && (!typeFilter || typeFilter.has(event.type))) {
                  await handler(event);
                }
                await conn.xack(STREAM_KEY, group, id);
              } catch (err) {
                this.logger.error(
                  `Handler failed for event ${event?.eventId} (${event?.type}) in group ${group}`,
                  err instanceof Error ? err.stack : String(err),
                );
                // Left unacked → redelivered / claimable by a reaper. No data loss.
              }
            }
          }
        } catch (err) {
          if (running) {
            this.logger.error('Event bus read loop error', err instanceof Error ? err.stack : err);
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
    };

    const handle = {
      stop: () => {
        running = false;
      },
    };
    this.subscribers.add(handle);
    void loop();

    return {
      unsubscribe: async () => {
        handle.stop();
        this.subscribers.delete(handle);
        await conn.quit().catch(() => undefined);
      },
    };
  }

  private async ensureGroup(conn: Redis, group: string): Promise<void> {
    try {
      await conn.xgroup('CREATE', STREAM_KEY, group, '$', 'MKSTREAM');
    } catch (err) {
      // BUSYGROUP means the group already exists — expected & fine.
      if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) throw err;
    }
  }

  private decode(fields: string[]): StoredEvent | null {
    const idx = fields.indexOf('data');
    if (idx === -1) return null;
    try {
      const parsed = JSON.parse(fields[idx + 1]!) as StoredEvent;
      return isEventType(parsed.type) ? parsed : parsed; // keep unknown types flowing; consumers filter
    } catch {
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const s of this.subscribers) s.stop();
  }
}
