import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  AiTaskType,
  AvitoEventType,
  MarketplaceCode,
  type AvitoAdStudioDto,
  type AvitoAdStudioUpdateDto,
  type AvitoQualityReportDto,
} from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { PrismaService } from '../prisma/prisma.service';
import { AdsService } from '../../modules/ads/application/ads.service';
import { ListingStudioService } from '../commerce/commerce-services';
import { AiGatewayService } from '../ai-platform/gateway/ai-gateway.service';
import { AvitoEventPublisher } from '../avito/events/avito-event.publisher';
import { AvitoOperationsAdsService } from './avito-operations-ads.service';
import { AvitoOperationsTimelineService } from './avito-operations-timeline.service';

@Injectable()
export class AvitoOperationsStudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: AvitoOperationsAdsService,
    private readonly adsCmd: AdsService,
    private readonly studio: ListingStudioService,
    private readonly ai: AiGatewayService,
    private readonly timeline: AvitoOperationsTimelineService,
    private readonly publisher: AvitoEventPublisher,
  ) {}

  async getStudio(tenantId: string, adId: string): Promise<AvitoAdStudioDto | null> {
    const page = await this.ads.search(tenantId, { limit: 1, q: undefined });
    const ad = page.items.find((a) => a.id === adId) ?? (await this.buildSingle(tenantId, adId));
    if (!ad) return null;

    const enrichment = await this.prisma.avitoAdEnrichmentReadModel.findUnique({
      where: { tenantId_adId: { tenantId, adId } },
    });
    const assets = await this.prisma.mediaAssetReadModel.findMany({
      where: { tenantId, entityId: adId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const history = await this.prisma.listingHistoryEntry.findMany({
      where: { tenantId, adId },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    });

    const validation = this.validate(ad, enrichment?.description ?? '');
    const seo = this.seoScore(ad.title, enrichment?.description ?? '');

    return {
      ad,
      mediaAssets: assets.map((a) => ({ id: a.id, kind: a.kind, publicUrl: a.publicUrl, mimeType: a.mimeType })),
      validation,
      aiSuggestions: validation.warnings,
      seo,
      history: history.map((h) => ({
        at: h.recordedAt.toISOString(),
        changeType: h.changeType,
        snapshot: h.snapshot,
      })),
      versions: [{ version: enrichment?.version ?? 1, updatedAt: ad.updatedAt }],
      analytics: {
        views: ad.metrics.views,
        contacts: ad.metrics.contacts,
        ctr: ad.metrics.ctr,
        forecast: ad.metrics.contacts > ad.metrics.views * 0.02 ? 'stable' : 'needs_improvement',
      },
      limitations: [
        'Прямое редактирование на Avito — через Autoload Feed или POST /core/v1/items/{id}/update_price (только цена)',
        'Title/description хранятся локально до экспорта в Feed',
      ],
    };
  }

  async updateStudio(tenantId: string, adId: string, dto: AvitoAdStudioUpdateDto, ctx: AppendContext) {
    const row = await this.prisma.adReadModel.findFirst({ where: { id: adId, tenantId } });
    if (!row) return null;

    if (dto.price) {
      await this.adsCmd.changePrice(adId, { price: dto.price, reason: 'studio_update' });
    }

    await this.ads.upsertEnrichment(tenantId, adId, {
      description: dto.description,
      tags: dto.tags,
      params: dto.params,
    });

    if (dto.title || dto.regionId || dto.cityId || dto.categoryId) {
      await this.prisma.adReadModel.update({
        where: { id: adId },
        data: {
          ...(dto.title ? { title: dto.title } : {}),
          ...(dto.regionId ? { regionId: dto.regionId } : {}),
          ...(dto.cityId ? { cityId: dto.cityId } : {}),
          ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
          ...(dto.subcategoryId !== undefined ? { subcategoryId: dto.subcategoryId } : {}),
          updatedAt: new Date(),
        },
      });
    }

    await this.studio.recordHistory(tenantId, adId, 'studio_update', dto as Record<string, unknown>);
    await this.timeline.append(tenantId, {
      adId,
      kind: 'update',
      title: 'Advertisement Studio',
      detail: Object.keys(dto).join(', '),
      correlationId: ctx.correlationId,
    });

    return this.getStudio(tenantId, adId);
  }

  async qualityReport(tenantId: string, adId: string): Promise<AvitoQualityReportDto | null> {
    const studio = await this.getStudio(tenantId, adId);
    if (!studio) return null;

    const { ad, validation, seo } = studio;
    const enrichment = await this.prisma.avitoAdEnrichmentReadModel.findUnique({
      where: { tenantId_adId: { tenantId, adId } },
    });
    const desc = enrichment?.description ?? '';
    const missing: string[] = [];
    if (!ad.imageUrl) missing.push('photo');
    if (!desc || desc.length < 50) missing.push('description');
    if (ad.price.amount <= 0) missing.push('price');
    if (ad.categoryId === 'unknown') missing.push('category');

    const photoIssues: string[] = [];
    if (!ad.imageUrl) photoIssues.push('Нет фото');

    const descriptionIssues: string[] = [];
    if (desc.length < 100) descriptionIssues.push('Описание короче 100 символов');

    const score = Math.max(0, Math.min(100, 100 - missing.length * 15 - validation.errors.length * 10 + seo.score / 5));

    await this.ads.upsertEnrichment(tenantId, adId, { qualityScore: score });

    return {
      adId,
      qualityScore: score,
      errors: validation.errors,
      missingFields: missing,
      photoIssues,
      descriptionIssues,
      keywordGaps: seo.keywords.filter((k) => !desc.toLowerCase().includes(k.toLowerCase())),
      recommendations: [...validation.warnings, ...seo.recommendations],
    };
  }

  async aiRewrite(tenantId: string, adId: string, ctx: AppendContext): Promise<{ output: string } | null> {
    const row = await this.prisma.adReadModel.findFirst({ where: { id: adId, tenantId } });
    if (!row) return null;
    const enrichment = await this.prisma.avitoAdEnrichmentReadModel.findUnique({
      where: { tenantId_adId: { tenantId, adId } },
    });

    const result = await this.ai.executeWithContext(
      {
        taskType: AiTaskType.LISTING,
        input: `Rewrite listing. Title: ${row.title}. Description: ${enrichment?.description ?? ''}. Price: ${row.priceAmount} RUB.`,
        skillIds: ['listing'],
        maxSteps: 3,
      },
      { tenantId, actorId: ctx.actor.id, correlationId: ctx.correlationId, runId: uuid() },
    );

    await this.ads.upsertEnrichment(tenantId, adId, { description: result.output, aiRecommendation: 'AI rewrite applied' });
    await this.timeline.append(tenantId, { adId, kind: 'ai', title: 'AI Rewrite', detail: result.output.slice(0, 200), correlationId: ctx.correlationId });
    await this.publisher.publish(tenantId, `ops:${adId}`, AvitoEventType.ListingPipelineCompleted, {
      pipelineId: uuid(),
      adId,
      qualityScore: 75,
      completedAt: new Date().toISOString(),
    }, ctx);

    return { output: result.output };
  }

  private async buildSingle(tenantId: string, adId: string) {
    const page = await this.ads.search(tenantId, { limit: 500 });
    return page.items.find((a) => a.id === adId) ?? null;
  }

  private validate(ad: { title: string; price: { amount: number }; externalId: string | null }, description: string) {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (ad.title.length < 5) errors.push('Заголовок слишком короткий');
    if (description.length < 30) warnings.push('Добавьте более подробное описание');
    if (!ad.externalId) warnings.push('Объявление не связано с Avito externalId — только локальный черновик');
    return { ok: errors.length === 0, errors, warnings };
  }

  private seoScore(title: string, description: string) {
    const words = `${title} ${description}`.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const keywords = [...new Set(words)].slice(0, 10);
    const score = Math.min(100, keywords.length * 8 + (description.length > 200 ? 20 : 0));
    const recommendations: string[] = [];
    if (description.length < 200) recommendations.push('Расширьте описание для SEO');
    if (title.length < 20) recommendations.push('Добавьте ключевые слова в заголовок');
    return { score, keywords, recommendations };
  }
}
