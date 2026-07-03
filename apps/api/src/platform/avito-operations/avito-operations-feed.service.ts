import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { AvitoFeedExportDto, AvitoFeedStudioDto } from '@neeklo/contracts';
import { MarketplaceCode } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { ObjectStorageService } from '../avito/storage/object-storage.service';
import { AvitoOperationsTimelineService } from './avito-operations-timeline.service';

@Injectable()
export class AvitoOperationsFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly timeline: AvitoOperationsTimelineService,
  ) {}

  async getStudio(tenantId: string, accountId: string): Promise<AvitoFeedStudioDto> {
    const autoload = await this.prisma.avitoLiveSnapshotReadModel.findUnique({
      where: { tenantId_accountId_domain: { tenantId, accountId, domain: 'autoload' } },
    });
    const uploads = (autoload?.payload as { uploads?: unknown[] })?.uploads ?? [];
    const profile = (autoload?.payload as { profile?: unknown })?.profile ?? autoload?.payload ?? null;

    const history = await this.prisma.avitoFeedExportReadModel.findMany({
      where: { tenantId, accountId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const pending = await this.prisma.avitoAdEnrichmentReadModel.count({
      where: { tenantId, feedStatus: 'ready' },
    });

    return {
      autoloadProfile: profile,
      uploads: Array.isArray(uploads) ? uploads : [],
      templates: history.slice(0, 10).map((h) => ({
        id: h.id,
        name: `Export ${h.format} v${h.version}`,
        format: h.format,
        updatedAt: h.createdAt.toISOString(),
      })),
      history: history.map((h) => ({
        id: h.id,
        format: h.format,
        adCount: h.adCount,
        status: h.status,
        createdAt: h.createdAt.toISOString(),
        version: h.version,
      })),
      queue: { pending, processing: 0, failed: history.filter((h) => h.status === 'failed').length },
      limitations: [
        'Публикация объявлений — только через официальный Autoload (XML/CSV feed upload)',
        'REST API не поддерживает create/delete item',
        'Загрузка feed: POST /autoload/v4/uploads — требует настройки профиля Autoload в кабинете Avito',
      ],
    };
  }

  async exportFeed(tenantId: string, dto: AvitoFeedExportDto) {
    const ads = await this.prisma.adReadModel.findMany({
      where: {
        tenantId,
        marketplace: MarketplaceCode.AVITO,
        ...(dto.adIds?.length ? { id: { in: dto.adIds } } : {}),
      },
      take: 5000,
    });

    const enrichments = await this.prisma.avitoAdEnrichmentReadModel.findMany({
      where: { tenantId, adId: { in: ads.map((a) => a.id) } },
    });
    const enrichMap = new Map(enrichments.map((e) => [e.adId, e]));

    let body: string;
    if (dto.format === 'json') {
      body = JSON.stringify(
        ads.map((a) => ({
          id: a.externalId ?? a.id,
          title: a.title,
          price: a.priceAmount,
          description: enrichMap.get(a.id)?.description ?? '',
          categoryId: a.categoryId,
          regionId: a.regionId,
          cityId: a.cityId,
        })),
        null,
        2,
      );
    } else if (dto.format === 'csv') {
      const header = 'Id,Title,Price,Category,Region,City,Description\n';
      const rows = ads
        .map((a) => {
          const desc = (enrichMap.get(a.id)?.description ?? '').replace(/"/g, '""');
          return `"${a.externalId ?? a.id}","${a.title.replace(/"/g, '""')}",${a.priceAmount},"${a.categoryId}","${a.regionId}","${a.cityId}","${desc}"`;
        })
        .join('\n');
      body = header + rows;
    } else {
      const items = ads
        .map(
          (a) => `
  <Ad>
    <Id>${a.externalId ?? a.id}</Id>
    <Title><![CDATA[${a.title}]]></Title>
    <Price>${a.priceAmount}</Price>
    <CategoryId>${a.categoryId}</CategoryId>
    <RegionId>${a.regionId}</RegionId>
    <CityId>${a.cityId}</CityId>
    <Description><![CDATA[${enrichMap.get(a.id)?.description ?? ''}]]></Description>
  </Ad>`,
        )
        .join('');
      body = `<?xml version="1.0" encoding="UTF-8"?>\n<Ads>${items}\n</Ads>`;
    }

    const stored = await this.storage.putObject(
      tenantId,
      'feeds',
      `${dto.accountId}-${Date.now()}.${dto.format === 'json' ? 'json' : dto.format === 'csv' ? 'csv' : 'xml'}`,
      body,
      dto.format === 'json' ? 'application/json' : dto.format === 'csv' ? 'text/csv' : 'application/xml',
    );

    const last = await this.prisma.avitoFeedExportReadModel.findFirst({
      where: { tenantId, accountId: dto.accountId },
      orderBy: { version: 'desc' },
    });

    const row = await this.prisma.avitoFeedExportReadModel.create({
      data: {
        tenantId,
        accountId: dto.accountId,
        format: dto.format,
        adCount: ads.length,
        status: 'completed',
        version: (last?.version ?? 0) + 1,
        storageKey: stored.key,
        publicUrl: stored.publicUrl,
        payload: { adIds: ads.map((a) => a.id) },
        createdAt: new Date(),
      },
    });

    for (const ad of ads) {
      await this.prisma.avitoAdEnrichmentReadModel.upsert({
        where: { tenantId_adId: { tenantId, adId: ad.id } },
        create: { tenantId, adId: ad.id, feedStatus: 'exported' },
        update: { feedStatus: 'exported', version: { increment: 1 } },
      });
    }

    await this.timeline.append(tenantId, {
      accountId: dto.accountId,
      kind: 'feed',
      title: `Feed export ${dto.format}`,
      detail: `${ads.length} ads → ${stored.publicUrl}`,
    });

    return { exportId: row.id, url: stored.publicUrl, adCount: ads.length, format: dto.format, version: row.version };
  }
}
