import { Injectable } from '@nestjs/common';
import type {
  AvitoOperationsHealthDto,
  AvitoOperationsTimelineEntryDto,
} from '@neeklo/contracts';
import { MarketplaceCode } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AvitoOperationsAdsService } from './avito-operations-ads.service';
import { AvitoOperationsFeedService } from './avito-operations-feed.service';
import { AvitoOperationsPromotionService } from './avito-operations-promotion.service';
import { AvitoOperationsTimelineService } from './avito-operations-timeline.service';
import { RegionalPublishingService } from '../avito/regional/regional-publishing.service';

@Injectable()
export class AvitoOperationsCenterService {
  constructor(
    private readonly ads: AvitoOperationsAdsService,
    private readonly feed: AvitoOperationsFeedService,
    private readonly promotion: AvitoOperationsPromotionService,
    private readonly timelineSvc: AvitoOperationsTimelineService,
    private readonly regional: RegionalPublishingService,
    private readonly prisma: PrismaService,
  ) {}

  searchAds = (tenantId: string, filters: Parameters<AvitoOperationsAdsService['search']>[1]) =>
    this.ads.search(tenantId, filters);

  listRegionalDrafts = (tenantId: string, batchId?: string) => this.regional.listDrafts(tenantId, batchId);

  getFeedStudio = (tenantId: string, accountId: string) => this.feed.getStudio(tenantId, accountId);

  getPromotionCenter = (tenantId: string, accountId: string) => this.promotion.getCenter(tenantId, accountId);

  async getTimeline(tenantId: string, opts: { adId?: string; accountId?: string; limit?: number }): Promise<AvitoOperationsTimelineEntryDto[]> {
    const rows = await this.timelineSvc.list(tenantId, opts);
    return rows.map((r) => ({
      id: r.id,
      at: r.occurredAt.toISOString(),
      kind: r.kind as AvitoOperationsTimelineEntryDto['kind'],
      adId: r.adId,
      title: r.title,
      detail: r.detail,
      correlationId: r.correlationId,
    }));
  }

  async getHealth(tenantId: string, accountId?: string): Promise<AvitoOperationsHealthDto> {
    const adsCount = await this.prisma.adReadModel.count({ where: { tenantId, marketplace: MarketplaceCode.AVITO } });
    const syncedCount = accountId
      ? await this.prisma.avitoLiveSyncWorkerReadModel.count({
          where: { tenantId, accountId, lastStatus: 'completed' },
        })
      : 0;
    const feedReadyCount = await this.prisma.avitoAdEnrichmentReadModel.count({
      where: { tenantId, feedStatus: { in: ['ready', 'exported'] } },
    });

    const autoload = accountId
      ? await this.prisma.avitoLiveSnapshotReadModel.findUnique({
          where: { tenantId_accountId_domain: { tenantId, accountId, domain: 'autoload' } },
        })
      : null;

    const promo = accountId ? await this.promotion.getCenter(tenantId, accountId) : null;

    return {
      adsCount,
      syncedCount,
      feedReadyCount,
      promotionAvailable: (promo?.services.length ?? 0) > 0,
      autoloadAvailable: autoload != null,
      directPublishAvailable: false,
      limitations: [
        'Прямая публикация объявлений через REST недоступна',
        'Autoload Feed — единственный официальный канал массовой публикации',
        'Цена — единственное поле с REST update: POST /core/v1/items/{id}/update_price',
      ],
    };
  }
}
