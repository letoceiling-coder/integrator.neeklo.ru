import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { MarketplaceCode } from '@neeklo/contracts';
import type { BulkAdActionDto, AdTemplateDto } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AdsService } from '../../../modules/ads/application/ads.service';
import { ListingStudioService } from '../../commerce/commerce-services';

/** Avito Ads Manager — bulk ops, templates, groups, search extensions. */
@Injectable()
export class AvitoAdsManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: AdsService,
    private readonly listingStudio: ListingStudioService,
  ) {}

  async searchAds(
    tenantId: string,
    filters: { q?: string; status?: string; groupId?: string; regionId?: string },
    limit = 100,
  ) {
    const ads = await this.prisma.adReadModel.findMany({
      where: {
        tenantId,
        marketplace: MarketplaceCode.AVITO,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.regionId ? { regionId: filters.regionId } : {}),
        ...(filters.q
          ? {
              OR: [
                { title: { contains: filters.q, mode: 'insensitive' } },
                { externalId: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    if (filters.groupId) {
      const group = await this.prisma.adGroupReadModel.findFirst({
        where: { id: filters.groupId, tenantId },
      });
      if (group) return ads.filter((a) => group.adIds.includes(a.id));
    }

    return ads;
  }

  async bulkAction(tenantId: string, dto: BulkAdActionDto) {
    const results: { adId: string; ok: boolean; error?: string }[] = [];

    for (const adId of dto.adIds) {
      try {
        const ad = await this.prisma.adReadModel.findFirst({ where: { id: adId, tenantId } });
        if (!ad) {
          results.push({ adId, ok: false, error: 'not_found' });
          continue;
        }

        switch (dto.action) {
          case 'archive':
            await this.ads.archive(adId, 'bulk_action');
            break;
          case 'price_change': {
            const delta = dto.priceDelta ?? 0;
            await this.ads.changePrice(adId, {
              price: { amount: Math.max(1, ad.priceAmount + delta), currency: ad.priceCurrency },
              reason: 'bulk_price_change',
            });
            break;
          }
          case 'copy':
            await this.ads.create({
              marketplace: MarketplaceCode.AVITO,
              title: `${ad.title} (копия)`,
              categoryId: ad.categoryId,
              subcategoryId: ad.subcategoryId,
              regionId: ad.regionId,
              cityId: ad.cityId,
              price: { amount: ad.priceAmount, currency: ad.priceCurrency },
              description: '',
            });
            break;
          case 'group':
            if (dto.groupId) await this.addToGroup(tenantId, dto.groupId, adId);
            break;
        }
        results.push({ adId, ok: true });
      } catch (e) {
        results.push({ adId, ok: false, error: e instanceof Error ? e.message : 'error' });
      }
    }

    return { processed: results.length, results };
  }

  async createTemplate(tenantId: string, dto: AdTemplateDto) {
    const id = uuid();
    await this.prisma.adTemplateReadModel.create({
      data: {
        id,
        tenantId,
        name: dto.name,
        categoryId: dto.categoryId,
        titleTemplate: dto.titleTemplate,
        descriptionTemplate: dto.descriptionTemplate,
        defaultPrice: dto.defaultPrice ?? null,
        createdAt: new Date(),
      },
    });
    return { id };
  }

  listTemplates(tenantId: string) {
    return this.prisma.adTemplateReadModel.findMany({ where: { tenantId }, orderBy: { usageCount: 'desc' } });
  }

  async createGroup(tenantId: string, name: string, adIds: string[] = []) {
    const id = uuid();
    await this.prisma.adGroupReadModel.create({
      data: { id, tenantId, name, adIds, createdAt: new Date() },
    });
    return { id };
  }

  listGroups(tenantId: string) {
    return this.prisma.adGroupReadModel.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async addToGroup(tenantId: string, groupId: string, adId: string) {
    const group = await this.prisma.adGroupReadModel.findFirst({ where: { id: groupId, tenantId } });
    if (!group) return;
    const adIds = group.adIds.includes(adId) ? group.adIds : [...group.adIds, adId];
    await this.prisma.adGroupReadModel.update({ where: { id: groupId }, data: { adIds } });
  }

  getStudio(adId: string, tenantId: string) {
    return this.listingStudio.getStudio(adId, tenantId);
  }
}
