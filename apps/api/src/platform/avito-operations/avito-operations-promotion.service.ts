import { Injectable } from '@nestjs/common';
import { MarketplaceCode, type AvitoPromotionCenterDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvitoOperationsPromotionService {
  constructor(private readonly prisma: PrismaService) {}

  async getCenter(tenantId: string, accountId: string): Promise<AvitoPromotionCenterDto> {
    const snap = await this.prisma.avitoLiveSnapshotReadModel.findUnique({
      where: { tenantId_accountId_domain: { tenantId, accountId, domain: 'promotion' } },
    });
    const worker = await this.prisma.avitoLiveSyncWorkerReadModel.findUnique({
      where: { tenantId_accountId_worker: { tenantId, accountId, worker: 'promotion' } },
    });

    const payload = (snap?.payload ?? {}) as { services?: unknown[]; dict?: unknown[] };
    const services = payload.services ?? payload.dict ?? [];

    const ads = await this.prisma.adReadModel.findMany({
      where: { tenantId, marketplace: MarketplaceCode.AVITO },
      orderBy: { ctr: 'desc' },
      take: 20,
    });

    const recommendations = ads
      .filter((a) => a.ctr < 0.02 && a.views > 10)
      .slice(0, 10)
      .map((a) => ({
        adId: a.id,
        title: a.title,
        suggestion: 'Низкий CTR — рассмотрите VAS через POST /core/v2/items/{itemId}/vas/',
        estimatedRoi: a.roi > 0 ? a.roi : null,
      }));

    return {
      services: Array.isArray(services) ? services : [],
      activePromotions: [],
      history: [],
      recommendations,
      limitations: [
        worker?.lastStatus === 'completed'
          ? 'Promotion dict synced from POST /promotion/v1/items/services/dict'
          : 'Promotion sync не выполнен — запустите Live Sync',
        'Применение VAS: PUT /core/v2/items/{itemId}/vas/ — требует itemId и выбранную услугу',
        'CPX promo: cpxpromo/1/* — отдельные endpoints для ставок',
        'Прямое управление из UI — только после выбора услуги из официального dict',
      ],
    };
  }
}
