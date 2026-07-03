import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiTaskType, type AvitoExecutiveAiDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from '../ai-platform/gateway/ai-gateway.service';
import { AvitoAnalyticsCenterService } from '../avito/analytics/avito-analytics-center.service';
import { AvitoObservatoryService } from './ai-observatory.service';
import { AiOpportunitiesService } from './ai-opportunities.service';

@Injectable()
export class ExecutiveAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
    private readonly analytics: AvitoAnalyticsCenterService,
    private readonly observatory: AvitoObservatoryService,
    private readonly opportunities: AiOpportunitiesService,
  ) {}

  async getSnapshot(tenantId: string): Promise<AvitoExecutiveAiDto> {
    const cached = await this.prisma.avitoExecutiveAiSnapshotReadModel.findFirst({
      where: { tenantId, generatedAt: { gte: new Date(Date.now() - 3600_000) } },
      orderBy: { generatedAt: 'desc' },
    });
    if (cached) {
      return {
        generatedAt: cached.generatedAt.toISOString(),
        summary: cached.summary,
        highlights: cached.highlights as string[],
        risks: cached.risks as string[],
        opportunities: cached.opportunities as string[],
        plainLanguage: cached.plainLanguage,
      };
    }
    return this.generate(tenantId);
  }

  async generate(tenantId: string): Promise<AvitoExecutiveAiDto> {
    const [summary, feed, opps] = await Promise.all([
      this.analytics.getSummary(tenantId),
      this.observatory.getFeed(tenantId),
      this.opportunities.list(tenantId),
    ]);

    const context = `
Business metrics: views=${summary.views}, revenue=${summary.revenue}, spend=${summary.spend}, ROI=${(summary.roi * 100).toFixed(0)}%
Warnings: ${feed.counts.warnings}, Anomalies: ${feed.counts.anomalies}
Opportunities: ${opps.slice(0, 3).map((o) => o.reason).join('; ')}
`;

    const ai = await this.gateway.executeWithContext(
      {
        taskType: AiTaskType.SUMMARY,
        input: `Explain to a business owner in simple Russian what is happening with their Avito business. Context:\n${context}\nReturn JSON: {"summary":"2-3 sentences","highlights":["..."],"risks":["..."],"opportunities":["..."],"plainLanguage":"full paragraph in plain language"}`,
        skillIds: ['executive', 'analytics'],
        context: { entityType: 'organization', entityId: tenantId },
        maxSteps: 2,
      },
      { tenantId, actorId: null, correlationId: tenantId, runId: uuid() },
    );

    let parsed = {
      summary: 'Бизнес на Avito работает стабильно.',
      highlights: [] as string[],
      risks: [] as string[],
      opportunities: opps.slice(0, 3).map((o) => o.reason),
      plainLanguage: ai.output,
    };
    try {
      parsed = { ...parsed, ...JSON.parse(ai.output.match(/\{[\s\S]*\}/)?.[0] ?? '{}') };
    } catch {
      parsed.plainLanguage = ai.output;
    }

    await this.prisma.avitoExecutiveAiSnapshotReadModel.create({
      data: {
        tenantId,
        summary: parsed.summary,
        highlights: parsed.highlights,
        risks: parsed.risks,
        opportunities: parsed.opportunities,
        plainLanguage: parsed.plainLanguage,
        generatedAt: new Date(),
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      summary: parsed.summary,
      highlights: parsed.highlights,
      risks: parsed.risks,
      opportunities: parsed.opportunities,
      plainLanguage: parsed.plainLanguage,
    };
  }
}
