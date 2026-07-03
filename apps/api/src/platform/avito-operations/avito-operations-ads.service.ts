import { Injectable } from '@nestjs/common';
import { MarketplaceCode } from '@neeklo/contracts';
import type { AvitoAdsFilterDto, AvitoEnrichedAdDto, AvitoAdsPageDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvitoOperationsAdsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, filters: AvitoAdsFilterDto): Promise<AvitoAdsPageDto> {
    const where: Record<string, unknown> = {
      tenantId,
      marketplace: MarketplaceCode.AVITO,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.regionId ? { regionId: filters.regionId } : {}),
      ...(filters.cityId ? { cityId: filters.cityId } : {}),
      ...(filters.contactsMin != null ? { contacts: { gte: filters.contactsMin } } : {}),
      ...(filters.ctrMin != null ? { ctr: { gte: filters.ctrMin } } : {}),
      ...(filters.aiScoreMin != null ? { aiScore: { gte: filters.aiScoreMin } } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            updatedAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: 'insensitive' } },
              { externalId: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (filters.priceMin != null || filters.priceMax != null) {
      where.priceAmount = {
        ...(filters.priceMin != null ? { gte: filters.priceMin } : {}),
        ...(filters.priceMax != null ? { lte: filters.priceMax } : {}),
      };
    }

    const total = await this.prisma.adReadModel.count({ where });
    const ads = await this.prisma.adReadModel.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: filters.limit,
      ...(filters.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
    });

    let filtered = ads;
    if (filters.groupId) {
      const group = await this.prisma.adGroupReadModel.findFirst({ where: { id: filters.groupId, tenantId } });
      if (group) filtered = ads.filter((a) => group.adIds.includes(a.id));
    }

    const enrichments = await this.prisma.avitoAdEnrichmentReadModel.findMany({
      where: { tenantId, adId: { in: filtered.map((a) => a.id) } },
    });
    const enrichMap = new Map(enrichments.map((e) => [e.adId, e]));

    const itemsWorker = filters.accountId
      ? await this.prisma.avitoLiveSyncWorkerReadModel.findUnique({
          where: { tenantId_accountId_worker: { tenantId, accountId: filters.accountId, worker: 'items' } },
        })
      : null;

    const items: AvitoEnrichedAdDto[] = filtered.map((ad) => {
      const e = enrichMap.get(ad.id);
      const errors = (e?.errors as string[] | null) ?? [];
      let promotionStatus = e?.promotionStatus ?? 'unknown';
      let feedStatus = e?.feedStatus ?? 'pending';
      if (filters.promotion === 'active' && promotionStatus !== 'active') return null;
      if (filters.promotion === 'none' && promotionStatus === 'active') return null;
      if (filters.autoload === 'synced' && feedStatus !== 'exported') return null;
      if (filters.autoload === 'pending' && feedStatus !== 'pending') return null;
      if (filters.tags?.length && !filters.tags.every((t) => (e?.tags ?? []).includes(t))) return null;

      const syncStatus = itemsWorker?.lastStatus ?? e?.syncStatus ?? 'pending';
      const health: AvitoEnrichedAdDto['health'] =
        errors.length > 0 ? 'error' : syncStatus === 'completed' ? 'healthy' : 'degraded';

      return {
        id: ad.id,
        externalId: ad.externalId,
        title: ad.title,
        categoryId: ad.categoryId,
        subcategoryId: ad.subcategoryId,
        regionId: ad.regionId,
        cityId: ad.cityId,
        price: { amount: ad.priceAmount, currency: ad.priceCurrency },
        status: ad.status,
        imageUrl: e?.imageUrl ?? null,
        publishedAt: ad.createdAt.toISOString(),
        updatedAt: ad.updatedAt.toISOString(),
        metrics: {
          views: ad.views,
          contacts: ad.contacts,
          favorites: ad.favorites,
          ctr: ad.ctr,
          messages: ad.messages,
        },
        aiScore: ad.aiScore ?? e?.qualityScore ?? null,
        aiRecommendation: e?.aiRecommendation ?? null,
        promotionStatus,
        feedStatus,
        syncStatus,
        webhookStatus: 'unknown',
        health,
        errors,
        version: e?.version ?? 1,
        tags: e?.tags ?? [],
      };
    }).filter(Boolean) as AvitoEnrichedAdDto[];

    const nextCursor = ads.length === filters.limit ? ads[ads.length - 1]?.id ?? null : null;

    return {
      items,
      total,
      nextCursor,
      limitations: [
        'REST create/delete объявлений недоступен — публикация только через Autoload Feed',
        'Изображения из Avito API доступны при наличии externalId и scope items:info',
      ],
    };
  }

  async upsertEnrichment(
    tenantId: string,
    adId: string,
    patch: Partial<{
      imageUrl: string | null;
      description: string;
      tags: string[];
      params: object;
      promotionStatus: string;
      feedStatus: string;
      syncStatus: string;
      qualityScore: number;
      aiRecommendation: string;
      errors: string[];
    }>,
  ) {
    return this.prisma.avitoAdEnrichmentReadModel.upsert({
      where: { tenantId_adId: { tenantId, adId } },
      create: {
        tenantId,
        adId,
        imageUrl: patch.imageUrl ?? null,
        description: patch.description ?? '',
        tags: patch.tags ?? [],
        params: patch.params ?? {},
        promotionStatus: patch.promotionStatus ?? 'unknown',
        feedStatus: patch.feedStatus ?? 'pending',
        syncStatus: patch.syncStatus ?? 'pending',
        qualityScore: patch.qualityScore ?? null,
        aiRecommendation: patch.aiRecommendation ?? null,
        errors: patch.errors ?? [],
      },
      update: {
        ...patch,
        version: { increment: 1 },
      },
    });
  }
}
