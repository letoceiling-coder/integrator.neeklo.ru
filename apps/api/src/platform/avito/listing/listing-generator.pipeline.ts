import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  AiTaskType,
  AvitoEventType,
  ListingPipelineStep,
  MarketplaceCode,
} from '@neeklo/contracts';
import type { ListingGeneratorInputDto } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { AiGatewayService } from '../../ai-platform/gateway/ai-gateway.service';
import { AdsService } from '../../../modules/ads/application/ads.service';
import { AvitoEventPublisher } from '../events/avito-event.publisher';

const STEPS: ListingPipelineStep[] = [
  ListingPipelineStep.RESEARCH,
  ListingPipelineStep.TITLE,
  ListingPipelineStep.DESCRIPTION,
  ListingPipelineStep.SEO,
  ListingPipelineStep.PSYCHOLOGY,
  ListingPipelineStep.REGIONAL,
  ListingPipelineStep.QUALITY,
  ListingPipelineStep.FINAL,
];

const STEP_PROMPTS: Record<ListingPipelineStep, string> = {
  [ListingPipelineStep.RESEARCH]: 'Research the product and target audience for Avito marketplace.',
  [ListingPipelineStep.TITLE]: 'Generate an optimized Avito listing title (max 50 chars).',
  [ListingPipelineStep.DESCRIPTION]: 'Write a compelling product description for Avito.',
  [ListingPipelineStep.SEO]: 'Add SEO keywords and structure for Avito search.',
  [ListingPipelineStep.PSYCHOLOGY]: 'Apply sales psychology: urgency, trust, benefits.',
  [ListingPipelineStep.REGIONAL]: 'Adapt copy for the target Russian region if specified.',
  [ListingPipelineStep.QUALITY]: 'Review listing quality and suggest improvements. Score 0-100.',
  [ListingPipelineStep.FINAL]: 'Produce final title and description as JSON: {"title":"","description":"","score":0}',
};

/** Multi-step Listing Generator pipeline via AI Platform. */
@Injectable()
export class ListingGeneratorPipeline {
  private readonly logger = new Logger(ListingGeneratorPipeline.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
    private readonly ads: AdsService,
    private readonly publisher: AvitoEventPublisher,
  ) {}

  async run(tenantId: string, input: ListingGeneratorInputDto, ctx: AppendContext) {
    const pipelineId = uuid();
    const runId = uuid();

    await this.prisma.listingPipelineReadModel.create({
      data: {
        id: pipelineId,
        tenantId,
        status: 'running',
        productInput: input.product,
        steps: [],
        startedAt: new Date(),
      },
    });

    await this.publisher.publish(tenantId, `pipeline:${pipelineId}`, AvitoEventType.ListingPipelineStarted, {
      pipelineId,
      productInput: input.product.slice(0, 200),
      startedAt: new Date().toISOString(),
    }, ctx);

    const stepOutputs: { step: ListingPipelineStep; output: string; completedAt: string }[] = [];
    let context = input.product;

    for (const step of STEPS) {
      const prompt = `${STEP_PROMPTS[step]}\n\nProduct:\n${input.product}\n\nPrior context:\n${context.slice(0, 3000)}`;
      const result = await this.gateway.executeWithContext(
        {
          taskType: AiTaskType.LISTING,
          input: prompt,
          skillIds: ['listing'],
          context: { step, categoryId: input.categoryId, regionId: input.regionId },
          maxSteps: 3,
        },
        { tenantId, actorId: ctx.actor.id, correlationId: ctx.correlationId, runId: uuid() },
      );

      stepOutputs.push({ step, output: result.output, completedAt: new Date().toISOString() });
      context = result.output;

      await this.publisher.publish(tenantId, `pipeline:${pipelineId}`, AvitoEventType.ListingPipelineStepCompleted, {
        pipelineId,
        step,
        outputPreview: result.output.slice(0, 200),
        completedAt: new Date().toISOString(),
      }, ctx);
    }

    const final = this.parseFinal(stepOutputs);
    let adId: string | null = null;

    if (input.createDraft && final.title) {
      const created = await this.ads.create({
        marketplace: MarketplaceCode.AVITO,
        title: final.title,
        categoryId: input.categoryId ?? 'general',
        subcategoryId: null,
        regionId: input.regionId ?? 'moscow',
        cityId: input.regionId ?? 'moscow',
        price: { amount: 1000, currency: 'RUB' },
        description: final.description,
      });
      adId = created.id;
    }

    await this.prisma.listingPipelineReadModel.update({
      where: { id: pipelineId },
      data: {
        status: 'completed',
        steps: stepOutputs,
        finalTitle: final.title,
        finalDescription: final.description,
        qualityScore: final.score,
        adId,
        completedAt: new Date(),
      },
    });

    await this.publisher.publish(tenantId, `pipeline:${pipelineId}`, AvitoEventType.ListingPipelineCompleted, {
      pipelineId,
      adId,
      qualityScore: final.score,
      completedAt: new Date().toISOString(),
    }, ctx);

    return { pipelineId, adId, ...final, steps: stepOutputs };
  }

  get(tenantId: string, pipelineId: string) {
    return this.prisma.listingPipelineReadModel.findFirst({ where: { id: pipelineId, tenantId } });
  }

  list(tenantId: string, limit = 20) {
    return this.prisma.listingPipelineReadModel.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  private parseFinal(steps: { output: string }[]) {
    const last = steps[steps.length - 1]?.output ?? '';
    try {
      const json = JSON.parse(last.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as {
        title?: string;
        description?: string;
        score?: number;
      };
      return {
        title: json.title ?? steps.find((s) => s.output.length < 80)?.output.slice(0, 50) ?? 'Черновик',
        description: json.description ?? last,
        score: json.score ?? 75,
      };
    } catch {
      return { title: 'Черновик объявления', description: last, score: 70 };
    }
  }
}
