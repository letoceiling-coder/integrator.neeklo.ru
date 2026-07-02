import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { EVENT_STORE, type EventStore } from '@neeklo/kernel';
import { PrismaService } from '../prisma/prisma.service';
import { type Projection } from './projection';

const BATCH_SIZE = 500;
const IDLE_DELAY_MS = 500;

/**
 * Drives every registered projection off the append-only log with independent checkpoints.
 * Each projection processes events in global order, exactly once; the read-model write and
 * the checkpoint advance happen in one transaction, so a crash never skips or double-applies.
 */
@Injectable()
export class ProjectionManager implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ProjectionManager.name);
  private running = true;
  private readonly loops: Promise<void>[] = [];
  private readonly projections: Projection[] = [];

  constructor(
    @Inject(EVENT_STORE) private readonly store: EventStore,
    private readonly prisma: PrismaService,
  ) {}

  /** Feature modules register their projections during bootstrap. */
  register(projection: Projection): void {
    this.projections.push(projection);
  }

  onApplicationBootstrap(): void {
    for (const projection of this.projections) {
      this.logger.log(`Starting projection: ${projection.name}`);
      this.loops.push(this.runLoop(projection));
    }
  }

  private async runLoop(projection: Projection): Promise<void> {
    while (this.running) {
      try {
        const processed = await this.drainOnce(projection);
        if (processed === 0) await this.sleep(IDLE_DELAY_MS);
      } catch (err) {
        this.logger.error(
          `Projection ${projection.name} loop error`,
          err instanceof Error ? err.stack : String(err),
        );
        await this.sleep(2000);
      }
    }
  }

  private async drainOnce(projection: Projection): Promise<number> {
    const checkpoint = await this.prisma.projectionCheckpoint.findUnique({
      where: { name: projection.name },
    });
    const from = checkpoint ? checkpoint.position.toString() : null;
    const events = await this.store.readAll(from, BATCH_SIZE);
    if (events.length === 0) return 0;

    for (const event of events) {
      await this.prisma.$transaction(async (tx) => {
        if (projection.handles.has(event.type)) {
          await projection.project(event, tx);
        }
        const position = BigInt(event.globalPosition!);
        await tx.projectionCheckpoint.upsert({
          where: { name: projection.name },
          create: { name: projection.name, position },
          update: { position },
        });
      });
    }
    return events.length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  onModuleDestroy(): void {
    this.running = false;
  }
}
