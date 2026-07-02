import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { RecommendationKind, EventType } from '@neeklo/contracts';
import type { ComputedMetrics } from '../metrics/metrics.engine';
import { MetricName } from '../metrics/metrics.engine';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenRouterClient } from '../../ai/openrouter.client';

export interface Recommendation {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  kind: string;
  confidence: number;
  reason: string;
  payload: Record<string, unknown>;
}

/**
 * Recommendation Engine — produces actionable recommendations for AI and managers.
 * AI receives recommendations, not raw events.
 */
@Injectable()
export class RecommendationEngine {
  private readonly logger = new Logger(RecommendationEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenRouterClient,
  ) {}

  async analyzeAd(tenantId: string, adId: string, metrics: ComputedMetrics): Promise<Recommendation[]> {
    const generated: Recommendation[] = [];
    const ad = await this.prisma.adReadModel.findUnique({ where: { id: adId } });
    if (!ad) return generated;

    const rules: Recommendation[] = [];

    if (metrics[MetricName.CTR] < 0.02 && ad.views > 50) {
      rules.push(this.build(tenantId, 'ad', adId, RecommendationKind.CHANGE_PHOTO, 0.72, 'CTR ниже 2% при значительных просмотрах'));
    }
    if (metrics[MetricName.ROI] < 0 && ad.spendAmount > 1000_00) {
      rules.push(this.build(tenantId, 'ad', adId, RecommendationKind.CHANGE_PRICE, 0.68, 'Отрицательный ROI при активных расходах'));
    }
    if (ad.viewsLast24h < 5 && ad.status === 'active') {
      rules.push(this.build(tenantId, 'ad', adId, RecommendationKind.BOOST, 0.81, 'Объявление теряет просмотры — рекомендуется поднятие'));
    }
    if ((ad.aiScore ?? 0) < 40) {
      rules.push(this.build(tenantId, 'ad', adId, RecommendationKind.CHANGE_DESCRIPTION, 0.65, 'Низкий AI Score — улучшите описание'));
    }

    for (const rec of rules) {
      await this.persist(rec);
      generated.push(rec);
    }

    return generated;
  }

  async listPending(tenantId: string, entityType?: string, entityId?: string): Promise<Recommendation[]> {
    const rows = await this.prisma.recommendationReadModel.findMany({
      where: {
        tenantId,
        status: 'pending',
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { confidence: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      entityType: r.entityType,
      entityId: r.entityId,
      kind: r.kind,
      confidence: r.confidence,
      reason: r.reason,
      payload: r.payload as Record<string, unknown>,
    }));
  }

  async accept(recommendationId: string): Promise<void> {
    await this.prisma.recommendationReadModel.update({
      where: { id: recommendationId },
      data: { status: 'accepted', resolvedAt: new Date() },
    });
  }

  async dismiss(recommendationId: string): Promise<void> {
    await this.prisma.recommendationReadModel.update({
      where: { id: recommendationId },
      data: { status: 'dismissed', resolvedAt: new Date() },
    });
  }

  /** AI-enhanced recommendation using analytics context (not raw events). */
  async enrichWithAi(recommendations: Recommendation[]): Promise<string> {
    if (recommendations.length === 0) return 'Нет активных рекомендаций.';
    const summary = recommendations
      .map((r) => `- [${r.kind}] ${r.reason} (уверенность ${Math.round(r.confidence * 100)}%)`)
      .join('\n');
    try {
      const result = await this.ai.chat('analytics', [
        { role: 'system', content: 'Ты AI-аналитик NEEKLO. Сформулируй краткий план действий по рекомендациям.' },
        { role: 'user', content: summary },
      ]);
      return result.text;
    } catch {
      return summary;
    }
  }

  private build(
    tenantId: string,
    entityType: string,
    entityId: string,
    kind: string,
    confidence: number,
    reason: string,
  ): Recommendation {
    return {
      id: uuid(),
      tenantId,
      entityType,
      entityId,
      kind,
      confidence,
      reason,
      payload: {},
    };
  }

  private async persist(rec: Recommendation): Promise<void> {
    await this.prisma.recommendationReadModel.create({
      data: {
        id: rec.id,
        tenantId: rec.tenantId,
        entityType: rec.entityType,
        entityId: rec.entityId,
        kind: rec.kind,
        confidence: rec.confidence,
        reason: rec.reason,
        payload: rec.payload,
        status: 'pending',
        generatedAt: new Date(),
      },
    });
  }
}
