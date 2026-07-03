import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiTaskType, type AvitoContentRecommendationDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from '../ai-platform/gateway/ai-gateway.service';

/** Content Intelligence — analyzes listing quality, no auto-edits. */
@Injectable()
export class ContentIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
  ) {}

  async list(tenantId: string, adId?: string): Promise<AvitoContentRecommendationDto[]> {
    const rows = await this.prisma.avitoContentRecommendationReadModel.findMany({
      where: { tenantId, status: 'pending', ...(adId ? { adId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      adId: r.adId,
      adTitle: r.adTitle,
      field: r.field as AvitoContentRecommendationDto['field'],
      suggestion: r.suggestion,
      score: r.score,
      status: r.status as AvitoContentRecommendationDto['status'],
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async analyzeAd(tenantId: string, adId: string): Promise<AvitoContentRecommendationDto[]> {
    const ad = await this.prisma.adReadModel.findFirst({ where: { id: adId, tenantId } });
    if (!ad) return [];

    const enrichment = await this.prisma.avitoAdEnrichmentReadModel.findFirst({
      where: { tenantId, adId },
    });

    const result = await this.gateway.executeWithContext(
      {
        taskType: AiTaskType.ANALYTICS,
        input: `Analyze Avito listing quality.
Title: ${ad.title}
Description: ${(enrichment?.description ?? '').slice(0, 500)}
CTR: ${ad.ctr}, Views: ${ad.views}, AI Score: ${ad.aiScore ?? 0}
SEO tags: ${enrichment?.tags?.join(', ') ?? 'none'}
Return JSON array max 5 items: [{"field":"photo|title|description|seo|keywords|quality","suggestion":"...","score":0-100}]`,
        skillIds: ['listing', 'seo'],
        context: { entityType: 'ad', entityId: adId },
        maxSteps: 3,
      },
      { tenantId, actorId: null, correlationId: adId, runId: uuid() },
    );

    let items: { field: string; suggestion: string; score: number }[] = [];
    try {
      items = JSON.parse(result.output.match(/\[[\s\S]*\]/)?.[0] ?? '[]');
    } catch {
      items = [
        { field: 'quality', suggestion: result.output.slice(0, 300), score: ad.aiScore ?? 50 },
      ];
    }

    const created: AvitoContentRecommendationDto[] = [];
    for (const item of items.slice(0, 5)) {
      const row = await this.prisma.avitoContentRecommendationReadModel.create({
        data: {
          tenantId,
          adId,
          adTitle: ad.title,
          field: item.field,
          suggestion: item.suggestion,
          score: item.score,
          status: 'pending',
          createdAt: new Date(),
        },
      });
      created.push({
        id: row.id,
        adId: row.adId,
        adTitle: row.adTitle,
        field: row.field as AvitoContentRecommendationDto['field'],
        suggestion: row.suggestion,
        score: row.score,
        status: 'pending',
        createdAt: row.createdAt.toISOString(),
      });
    }

    return created;
  }

  async analyzeTopAds(tenantId: string, limit = 5): Promise<{ analyzed: number }> {
    const ads = await this.prisma.adReadModel.findMany({
      where: { tenantId, status: 'active' },
      orderBy: { views: 'desc' },
      take: limit,
    });
    for (const ad of ads) {
      await this.analyzeAd(tenantId, ad.id);
    }
    return { analyzed: ads.length };
  }
}
