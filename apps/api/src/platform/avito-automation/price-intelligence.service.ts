import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiTaskType, type AvitoPriceRecommendationDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from '../ai-platform/gateway/ai-gateway.service';
import { DecisionEngine } from '../intelligence/decision/decision.engine';
import { MetricsWarehouseEngine } from '../intelligence/warehouse/metrics-warehouse.engine';

/** Price Intelligence — recommendations only, no automatic price changes. */
@Injectable()
export class PriceIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
    private readonly decision: DecisionEngine,
    private readonly metrics: MetricsWarehouseEngine,
  ) {}

  async list(tenantId: string, status = 'pending'): Promise<AvitoPriceRecommendationDto[]> {
    const rows = await this.prisma.avitoPriceRecommendationReadModel.findMany({
      where: { tenantId, status },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      adId: r.adId,
      adTitle: r.adTitle,
      currentPrice: r.currentPrice,
      suggestedPrice: r.suggestedPrice,
      direction: r.direction as AvitoPriceRecommendationDto['direction'],
      confidence: r.confidence,
      reason: r.reason,
      status: r.status as AvitoPriceRecommendationDto['status'],
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async generateForTenant(tenantId: string): Promise<{ created: number }> {
    const ads = await this.prisma.adReadModel.findMany({
      where: { tenantId, status: 'active' },
      take: 20,
    });
    let created = 0;

    for (const ad of ads) {
      const existing = await this.prisma.avitoPriceRecommendationReadModel.findFirst({
        where: { tenantId, adId: ad.id, status: 'pending' },
      });
      if (existing) continue;

      const m = await this.metrics.syncFromHistorical(tenantId, 'ad', ad.id);
      await this.decision.decide(tenantId, 'ad', ad.id).catch(() => []);

      const currentPrice = ad.priceAmount ?? 0;
      let direction: 'up' | 'down' | 'hold' = 'hold';
      let suggestedPrice = currentPrice;
      let confidence = 0.6;
      let reason = 'Недостаточно данных для изменения цены';

      if (m) {
        if (m.ctr > 0.05 && m.roi > 0.3) {
          direction = 'up';
          suggestedPrice = Math.round(currentPrice * 1.05);
          confidence = 0.75;
          reason = `Высокий CTR (${(m.ctr * 100).toFixed(1)}%) и ROI — можно повысить цену на 5%`;
        } else if (m.ctr < 0.01 && m.views > 100) {
          direction = 'down';
          suggestedPrice = Math.round(currentPrice * 0.95);
          confidence = 0.7;
          reason = `Низкий CTR при ${m.views} просмотрах — рекомендуем снизить цену на 5%`;
        } else if (m.opportunityScore > 60) {
          direction = 'hold';
          reason = `Opportunity score ${m.opportunityScore.toFixed(0)} — цена оптимальна`;
          confidence = 0.65;
        }
      }

      try {
        const ai = await this.gateway.executeWithContext(
          {
            taskType: AiTaskType.ANALYTICS,
            input: `Ad "${ad.title}" price=${currentPrice}, ctr=${ad.ctr}, views=${ad.views}. Recommend price direction (up/down/hold) with brief reason. JSON: {"direction":"up|down|hold","suggestedPrice":number,"confidence":0-1,"reason":"..."}`,
            skillIds: ['pricing', 'analytics'],
            context: { entityType: 'ad', entityId: ad.id },
            maxSteps: 2,
          },
          { tenantId, actorId: null, correlationId: ad.id, runId: uuid() },
        );
        const parsed = JSON.parse(ai.output.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as {
          direction?: string;
          suggestedPrice?: number;
          confidence?: number;
          reason?: string;
        };
        if (parsed.direction && ['up', 'down', 'hold'].includes(parsed.direction)) {
          direction = parsed.direction as typeof direction;
          suggestedPrice = parsed.suggestedPrice ?? suggestedPrice;
          confidence = parsed.confidence ?? confidence;
          reason = parsed.reason ?? reason;
        }
      } catch {
        /* keep heuristic */
      }

      if (direction === 'hold' && confidence < 0.65) continue;

      await this.prisma.avitoPriceRecommendationReadModel.create({
        data: {
          tenantId,
          adId: ad.id,
          adTitle: ad.title,
          currentPrice,
          suggestedPrice,
          direction,
          confidence,
          reason,
          status: 'pending',
          createdAt: new Date(),
        },
      });
      created++;
    }

    return { created };
  }

  async dismiss(tenantId: string, id: string) {
    return this.prisma.avitoPriceRecommendationReadModel.updateMany({
      where: { id, tenantId },
      data: { status: 'dismissed' },
    });
  }
}
