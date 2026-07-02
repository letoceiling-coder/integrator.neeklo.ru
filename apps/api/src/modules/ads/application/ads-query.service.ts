import { Injectable } from '@nestjs/common';
import type { AdReadModel as AdReadModelDto, MarketplaceCode, PageResponse } from '@neeklo/contracts';
import { NotFoundError } from '@neeklo/kernel';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import type { AdReadModel as AdRow } from '@prisma/client';

/** Read-side service (the "Q" in CQRS). Only ever touches projections, never the event store. */
@Injectable()
export class AdsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    params: { cursor?: string; limit: number; status?: string; marketplace?: string },
  ): Promise<PageResponse<AdReadModelDto>> {
    const rows = await this.prisma.adReadModel.findMany({
      where: {
        tenantId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.marketplace ? { marketplace: params.marketplace } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const page = hasMore ? rows.slice(0, params.limit) : rows;
    return {
      items: page.map((r) => this.toDto(r)),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async getById(tenantId: string, id: string): Promise<AdReadModelDto> {
    const row = await this.prisma.adReadModel.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundError('Ad', id);
    return this.toDto(row);
  }

  private toDto(r: AdRow): AdReadModelDto {
    return {
      id: r.id,
      tenantId: r.tenantId,
      marketplace: r.marketplace as MarketplaceCode,
      externalId: r.externalId,
      status: r.status as AdReadModelDto['status'],
      title: r.title,
      categoryId: r.categoryId,
      subcategoryId: r.subcategoryId,
      regionId: r.regionId,
      cityId: r.cityId,
      price: { amount: r.priceAmount, currency: r.priceCurrency },
      aiScore: r.aiScore,
      metrics: {
        views: r.views,
        viewsLast24h: r.viewsLast24h,
        favorites: r.favorites,
        contacts: r.contacts,
        messages: r.messages,
        ctr: r.ctr,
        conversion: r.conversion,
        spend: { amount: r.spendAmount, currency: r.priceCurrency },
        revenue: { amount: r.revenueAmount, currency: r.priceCurrency },
        roi: r.roi,
        costPerContact: r.costPerContact,
        costPerView: r.costPerView,
      },
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
