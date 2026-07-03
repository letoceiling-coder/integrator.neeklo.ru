import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiTaskType, type AvitoAiReportDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from '../ai-platform/gateway/ai-gateway.service';
import { AvitoAnalyticsCenterService } from '../avito/analytics/avito-analytics-center.service';
import { AvitoObservatoryService } from './ai-observatory.service';

@Injectable()
export class AiReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
    private readonly analytics: AvitoAnalyticsCenterService,
    private readonly observatory: AvitoObservatoryService,
  ) {}

  async list(tenantId: string): Promise<AvitoAiReportDto[]> {
    const rows = await this.prisma.avitoAiReportReadModel.findMany({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
      take: 14,
    });
    return rows.map((r) => this.toDto(r));
  }

  async getLatest(tenantId: string): Promise<AvitoAiReportDto | null> {
    const row = await this.prisma.avitoAiReportReadModel.findFirst({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
    });
    return row ? this.toDto(row) : null;
  }

  async generateMorningReport(tenantId: string): Promise<AvitoAiReportDto> {
    const [summary, feed, leads, deals] = await Promise.all([
      this.analytics.getSummary(tenantId),
      this.observatory.getFeed(tenantId),
      this.prisma.avitoLeadReadModel.count({ where: { tenantId } }),
      this.prisma.dealReadModel.findMany({ where: { tenantId }, take: 100 }),
    ]);

    const won = deals.filter((d) => d.stage === 'paid' || d.stage === 'completed').length;
    const context = `
Views: ${summary.views}, CTR: ${(summary.ctr * 100).toFixed(2)}%, ROI: ${(summary.roi * 100).toFixed(0)}%
Leads: ${leads}, Won deals: ${won}
Observatory: ${feed.counts.recommendations} recs, ${feed.counts.anomalies} anomalies, ${feed.counts.opportunities} opportunities
Top items: ${feed.items.slice(0, 5).map((i) => i.title).join('; ')}
`;

    const ai = await this.gateway.executeWithContext(
      {
        taskType: AiTaskType.SUMMARY,
        input: `Generate morning business report for Avito seller. Context:\n${context}\nReturn JSON: {"summary":"...","changes":["..."],"improvements":["..."],"todayActions":["..."],"fullText":"..."}`,
        skillIds: ['analytics', 'reporting'],
        context: { entityType: 'organization', entityId: tenantId },
        maxSteps: 2,
      },
      { tenantId, actorId: null, correlationId: tenantId, runId: uuid() },
    );

    let parsed = {
      summary: 'Отчёт за утро',
      changes: [] as string[],
      improvements: [] as string[],
      todayActions: [] as string[],
      fullText: ai.output,
    };
    try {
      parsed = { ...parsed, ...JSON.parse(ai.output.match(/\{[\s\S]*\}/)?.[0] ?? '{}') };
    } catch {
      parsed.fullText = ai.output;
    }

    const row = await this.prisma.avitoAiReportReadModel.create({
      data: {
        tenantId,
        summary: parsed.summary,
        changes: parsed.changes,
        improvements: parsed.improvements,
        todayActions: parsed.todayActions,
        fullText: parsed.fullText,
        generatedAt: new Date(),
      },
    });

    return this.toDto(row);
  }

  private toDto(r: {
    id: string;
    summary: string;
    changes: unknown;
    improvements: unknown;
    todayActions: unknown;
    fullText: string;
    generatedAt: Date;
  }): AvitoAiReportDto {
    return {
      id: r.id,
      generatedAt: r.generatedAt.toISOString(),
      summary: r.summary,
      changes: r.changes as string[],
      improvements: r.improvements as string[],
      todayActions: r.todayActions as string[],
      fullText: r.fullText,
    };
  }
}
