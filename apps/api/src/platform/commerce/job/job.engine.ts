import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { CommerceEventType } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { EVENT_BUS, EVENT_STORE, type EventBus, type EventStore } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaPipelineService } from '../../avito/media/media-pipeline.service';

/** Media Studio job engine — async media processing via AI Media Pipeline. */
@Injectable()
export class JobEngine {
  private readonly logger = new Logger(JobEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_STORE) private readonly store: EventStore,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    @Optional() @Inject(forwardRef(() => MediaPipelineService)) private readonly mediaPipeline?: MediaPipelineService,
  ) {}

  async createJob(
    tenantId: string,
    kind: string,
    input: Record<string, unknown>,
    entityType: string | null,
    entityId: string | null,
    ctx: AppendContext,
  ): Promise<{ jobId: string }> {
    const jobId = uuid();
    await this.prisma.mediaJobReadModel.create({
      data: {
        id: jobId,
        tenantId,
        kind,
        status: 'pending',
        input,
        entityType,
        entityId,
        createdAt: new Date(),
      },
    });

    await this.appendCommerceEvent(tenantId, `media:${jobId}`, CommerceEventType.MediaJobCreated, {
      kind,
      input,
      entityType,
      entityId,
    }, ctx);

    void this.processJob(jobId, tenantId, kind, input, entityType, entityId, ctx);
    return { jobId };
  }

  private async processJob(
    jobId: string,
    tenantId: string,
    kind: string,
    input: Record<string, unknown>,
    entityType: string | null,
    entityId: string | null,
    ctx: AppendContext,
  ): Promise<void> {
    await this.prisma.mediaJobReadModel.update({ where: { id: jobId }, data: { status: 'processing' } });

    try {
      let outputUrl: string;
      if (this.mediaPipeline) {
        const result = await this.mediaPipeline.processJob(tenantId, jobId, kind, input, entityType, entityId, ctx);
        outputUrl = result.outputUrl;
      } else {
        outputUrl = `https://cdn.neeklo.local/media/${jobId}/${kind}.png`;
      }

      await this.prisma.mediaJobReadModel.update({
        where: { id: jobId },
        data: { status: 'completed', outputUrl, completedAt: new Date() },
      });
      await this.appendCommerceEvent(tenantId, `media:${jobId}`, CommerceEventType.MediaJobCompleted, {
        outputUrl,
        completedAt: new Date().toISOString(),
      }, ctx);
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      await this.prisma.mediaJobReadModel.update({ where: { id: jobId }, data: { status: 'failed', error } });
      await this.appendCommerceEvent(tenantId, `media:${jobId}`, CommerceEventType.MediaJobFailed, {
        error,
        failedAt: new Date().toISOString(),
      }, ctx);
    }
  }

  listJobs(tenantId: string) {
    return this.prisma.mediaJobReadModel.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  private async appendCommerceEvent(
    tenantId: string,
    streamKey: string,
    type: CommerceEventType,
    payload: Record<string, unknown>,
    ctx: AppendContext,
  ): Promise<void> {
    const events = await this.store.readStream('commerce', streamKey);
    const expectedVersion = events.length > 0 ? events[events.length - 1]!.streamVersion : -1;
    const stored = await this.store.append('commerce', streamKey, [{ type, payload }], {
      tenantId,
      actor: ctx.actor,
      correlationId: ctx.correlationId,
      expectedVersion,
    });
    await this.bus.publish(stored);
  }
}
