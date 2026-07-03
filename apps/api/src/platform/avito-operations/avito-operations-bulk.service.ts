import { v4 as uuid } from 'uuid';
import type { AvitoBulkOperationDto } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { AvitoClient } from '../adapters/avito/avito.client';
import { AvitoAdsManagerService } from '../avito/ads/avito-ads-manager.service';
import { AdsService } from '../../modules/ads/application/ads.service';
import { AvitoOperationsAdsService } from './avito-operations-ads.service';
import { AvitoOperationsStudioService } from './avito-operations-studio.service';
import { AvitoOperationsTimelineService } from './avito-operations-timeline.service';
import { ObjectStorageService } from '../avito/storage/object-storage.service';

@Injectable()
export class AvitoOperationsBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avito: AvitoClient,
    private readonly adsManager: AvitoAdsManagerService,
    private readonly adsCmd: AdsService,
    private readonly enrichment: AvitoOperationsAdsService,
    private readonly studio: AvitoOperationsStudioService,
    private readonly timeline: AvitoOperationsTimelineService,
    private readonly storage: ObjectStorageService,
  ) {}

  async execute(tenantId: string, dto: AvitoBulkOperationDto, ctx: AppendContext) {
    const results: { adId: string; ok: boolean; error?: string; note?: string }[] = [];

    for (const adId of dto.adIds) {
      try {
        const ad = await this.prisma.adReadModel.findFirst({ where: { id: adId, tenantId } });
        if (!ad) {
          results.push({ adId, ok: false, error: 'not_found' });
          continue;
        }

        switch (dto.action) {
          case 'archive':
            await this.adsCmd.archive(adId, 'bulk');
            break;
          case 'price_change': {
            const delta = dto.priceDelta ?? 0;
            const amount = dto.price?.amount ?? Math.max(1, ad.priceAmount + delta);
            await this.adsCmd.changePrice(adId, { price: { amount, currency: ad.priceCurrency }, reason: 'bulk' });
            break;
          }
          case 'sync_price_avito':
            if (!dto.accountId || !ad.externalId) {
              results.push({ adId, ok: false, error: 'accountId and externalId required for Avito price sync' });
              continue;
            }
            await this.avito.request(tenantId, dto.accountId, 'POST', `/core/v1/items/${ad.externalId}/update_price`, {
              body: { price: dto.price?.amount ?? ad.priceAmount },
            });
            results.push({ adId, ok: true, note: 'Avito API price updated' });
            continue;
          case 'description_change':
            await this.enrichment.upsertEnrichment(tenantId, adId, { description: dto.description ?? '' });
            break;
          case 'region_change':
            await this.prisma.adReadModel.update({
              where: { id: adId },
              data: { regionId: dto.regionId ?? ad.regionId, cityId: dto.cityId ?? ad.cityId, updatedAt: new Date() },
            });
            break;
          case 'category_change':
            await this.prisma.adReadModel.update({
              where: { id: adId },
              data: { categoryId: dto.categoryId ?? ad.categoryId, updatedAt: new Date() },
            });
            break;
          case 'add_tags':
            await this.enrichment.upsertEnrichment(tenantId, adId, { tags: dto.tags ?? [] });
            break;
          case 'copy':
            await this.adsManager.bulkAction(tenantId, { adIds: [adId], action: 'copy' });
            break;
          case 'group':
            if (dto.groupId) await this.adsManager.bulkAction(tenantId, { adIds: [adId], action: 'group', groupId: dto.groupId });
            break;
          case 'prepare_feed':
            await this.enrichment.upsertEnrichment(tenantId, adId, { feedStatus: 'ready' });
            break;
          case 'export': {
            const payload = JSON.stringify({ adId, title: ad.title, price: ad.priceAmount, externalId: ad.externalId });
            const stored = await this.storage.putObject(tenantId, 'exports', `${adId}.json`, payload, 'application/json');
            results.push({ adId, ok: true, note: stored.publicUrl });
            continue;
          }
          case 'validate': {
            const q = await this.studio.qualityReport(tenantId, adId);
            results.push({ adId, ok: (q?.errors.length ?? 0) === 0, note: q ? `${q.qualityScore}/100` : 'unknown' });
            continue;
          }
          case 'ai_rewrite':
          case 'ai_optimize':
            await this.studio.aiRewrite(tenantId, adId, ctx);
            break;
        }

        await this.timeline.append(tenantId, {
          adId,
          accountId: dto.accountId ?? null,
          kind: 'update',
          title: `Bulk: ${dto.action}`,
          correlationId: ctx.correlationId,
        });
        results.push({ adId, ok: true });
      } catch (e) {
        results.push({ adId, ok: false, error: e instanceof Error ? e.message : 'error' });
      }
    }

    return { processed: results.length, results, limitations: this.limitations(dto.action) };
  }

  private limitations(action: string): string[] {
    const notes: string[] = [];
    if (action !== 'sync_price_avito') {
      notes.push('Локальные изменения не публикуются на Avito без Autoload Feed export');
    }
    if (action === 'sync_price_avito') {
      notes.push('Официальный API: POST /core/v1/items/{item_id}/update_price — только цена');
    }
    return notes;
  }
}
