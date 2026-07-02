import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiTaskType, AvitoEventType, MarketplaceCode } from '@neeklo/contracts';
import type { RegionalPublishInputDto } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { AiGatewayService } from '../../ai-platform/gateway/ai-gateway.service';
import { AdsService } from '../../../modules/ads/application/ads.service';
import { AvitoEventPublisher } from '../events/avito-event.publisher';

/** Regional Publishing — localized drafts per city (draft mode when Autoload unavailable). */
@Injectable()
export class RegionalPublishingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
    private readonly ads: AdsService,
    private readonly publisher: AvitoEventPublisher,
  ) {}

  async publishBatch(tenantId: string, input: RegionalPublishInputDto, ctx: AppendContext) {
    const batchId = uuid();
    const publishMode = 'draft' as const;
    const note =
      'Avito Autoload publication is not available via official API in this release. Drafts created locally for manual export.';

    await this.publisher.publish(tenantId, `regional:${batchId}`, AvitoEventType.RegionalPublishPlanned, {
      batchId,
      regionCount: input.regions.length,
      note,
    }, ctx);

    const drafts = [];

    for (const region of input.regions) {
      const prompt = `Adapt this listing for region ${region.regionId}, city ${region.cityId}. Base price ${input.basePrice} RUB. Product: ${input.product ?? 'see source ad'}. Return JSON: {"title":"","description":"","price":0}`;
      const result = await this.gateway.executeWithContext(
        {
          taskType: AiTaskType.LISTING,
          input: prompt,
          skillIds: ['listing'],
          context: { regionId: region.regionId, cityId: region.cityId },
          maxSteps: 3,
        },
        { tenantId, actorId: ctx.actor.id, correlationId: ctx.correlationId, runId: uuid() },
      );

      let localized = { title: `Объявление — ${region.cityId}`, description: result.output, price: input.basePrice };
      try {
        const parsed = JSON.parse(result.output.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as typeof localized;
        localized = { ...localized, ...parsed };
      } catch {
        /* use defaults */
      }

      const created = await this.ads.create({
        marketplace: MarketplaceCode.AVITO,
        title: localized.title,
        categoryId: 'general',
        subcategoryId: null,
        regionId: region.regionId,
        cityId: region.cityId,
        price: { amount: localized.price || input.basePrice, currency: 'RUB' },
        description: localized.description,
      });

      const draftId = uuid();
      await this.prisma.regionalDraftReadModel.create({
        data: {
          id: draftId,
          tenantId,
          batchId,
          sourceAdId: input.sourceAdId ?? null,
          draftAdId: created.id,
          regionId: region.regionId,
          cityId: region.cityId,
          localizedTitle: localized.title,
          localizedPrice: localized.price || input.basePrice,
          publishMode,
          createdAt: new Date(),
        },
      });

      await this.publisher.publish(tenantId, `regional:${batchId}`, AvitoEventType.RegionalDraftCreated, {
        batchId,
        sourceAdId: input.sourceAdId ?? null,
        regionId: region.regionId,
        cityId: region.cityId,
        draftAdId: created.id,
        localizedTitle: localized.title,
        publishMode,
      }, ctx);

      drafts.push({ draftId, adId: created.id, regionId: region.regionId, cityId: region.cityId, title: localized.title });
    }

    return { batchId, publishMode, note, drafts };
  }

  listDrafts(tenantId: string, batchId?: string) {
    return this.prisma.regionalDraftReadModel.findMany({
      where: { tenantId, ...(batchId ? { batchId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
