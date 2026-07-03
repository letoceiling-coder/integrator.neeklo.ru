import { Injectable } from '@nestjs/common';
import type { AvitoFeedValidationDto } from '@neeklo/contracts';
import { MarketplaceCode } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AvitoOperationsFeedService } from '../avito-operations/avito-operations-feed.service';

/** Feed production helpers — validate, diff, rollback on top of existing Feed Studio. */
@Injectable()
export class ProductionFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feed: AvitoOperationsFeedService,
  ) {}

  async validateFeed(tenantId: string, accountId: string): Promise<AvitoFeedValidationDto> {
    const ads = await this.prisma.adReadModel.findMany({
      where: { tenantId, marketplace: MarketplaceCode.AVITO },
      take: 5000,
    });
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const ad of ads) {
      if (!ad.title?.trim()) errors.push(`Ad ${ad.id}: empty title`);
      if (ad.priceAmount <= 0) warnings.push(`Ad ${ad.id}: price is zero`);
      if (!ad.categoryId) errors.push(`Ad ${ad.id}: missing category`);
    }

    const last = await this.prisma.avitoFeedExportReadModel.findFirst({
      where: { tenantId, accountId },
      orderBy: { version: 'desc' },
    });

    let xmlPreview: string | undefined;
    if (last?.storageKey) {
      xmlPreview = `Version ${last.version}, ${last.adCount} ads, ${last.publicUrl ?? last.storageKey}`;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      adCount: ads.length,
      xmlPreview,
    };
  }

  async diffVersions(tenantId: string, accountId: string, v1: number, v2: number) {
    const [a, b] = await Promise.all([
      this.prisma.avitoFeedExportReadModel.findFirst({ where: { tenantId, accountId, version: v1 } }),
      this.prisma.avitoFeedExportReadModel.findFirst({ where: { tenantId, accountId, version: v2 } }),
    ]);
    if (!a || !b) return { diff: [], message: 'Version not found' };
    const idsA = new Set(((a.payload as { adIds?: string[] })?.adIds ?? []));
    const idsB = new Set(((b.payload as { adIds?: string[] })?.adIds ?? []));
    const added = [...idsB].filter((id) => !idsA.has(id));
    const removed = [...idsA].filter((id) => !idsB.has(id));
    return { added, removed, from: v1, to: v2, adCountDelta: b.adCount - a.adCount };
  }

  async rollback(tenantId: string, accountId: string, version: number) {
    const target = await this.prisma.avitoFeedExportReadModel.findFirst({
      where: { tenantId, accountId, version },
    });
    if (!target) return { ok: false, message: 'Version not found' };
    const adIds = (target.payload as { adIds?: string[] })?.adIds;
    if (!adIds?.length) return { ok: false, message: 'No ad snapshot in version' };
    return {
      ok: true,
      message: `Rollback reference to v${version} — re-export with ${adIds.length} ads`,
      version,
      adIds,
      url: target.publicUrl,
    };
  }

  exportFeed(tenantId: string, dto: Parameters<AvitoOperationsFeedService['exportFeed']>[1]) {
    return this.feed.exportFeed(tenantId, dto);
  }
}
