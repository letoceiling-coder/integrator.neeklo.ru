import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiTaskType, DealStage, type AvitoDealAnalysisDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from '../ai-platform/gateway/ai-gateway.service';

@Injectable()
export class AvitoDealAnalyzerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
  ) {}

  async analyze(tenantId: string, dealId: string): Promise<AvitoDealAnalysisDto | null> {
    const deal = await this.prisma.dealReadModel.findFirst({ where: { id: dealId, tenantId } });
    if (!deal) return null;

    const conv = await this.prisma.conversationReadModel.findFirst({
      where: { tenantId, customerId: deal.customerId, ...(deal.adId ? { adId: deal.adId } : {}) },
    });
    const messages = conv
      ? await this.prisma.messageReadModel.findMany({
          where: { tenantId, conversationId: conv.id },
          take: 30,
          orderBy: { sentAt: 'desc' },
        })
      : [];

    const outcome =
      deal.stage === DealStage.COMPLETED || deal.stage === DealStage.PAID
        ? 'won'
        : deal.stage === DealStage.CANCELLED
          ? 'lost'
          : 'open';

    const result = await this.gateway.executeWithContext(
      {
        taskType: AiTaskType.SUMMARY,
        input: `Analyze deal stage=${deal.stage}, customer=${deal.customerName}, amount=${deal.expectedAmount}. Messages:\n${messages.map((m: { text: string }) => m.text).join('\n')}\nReturn JSON: {"whyBought":"...","whyLost":"...","improvements":["..."],"summary":"..."}`,
        skillIds: ['sales', 'analytics'],
        context: { entityType: 'deal', entityId: dealId, customerId: deal.customerId },
        maxSteps: 2,
      },
      { tenantId, actorId: null, correlationId: dealId, runId: uuid() },
    );

    let parsed = { whyBought: null as string | null, whyLost: null as string | null, improvements: [] as string[], summary: result.output };
    try {
      parsed = { ...parsed, ...JSON.parse(result.output.match(/\{[\s\S]*\}/)?.[0] ?? '{}') };
    } catch {
      parsed.summary = result.output;
    }

    const row = await this.prisma.avitoDealAnalysisReadModel.upsert({
      where: { tenantId_dealId: { tenantId, dealId } },
      create: {
        tenantId,
        dealId,
        outcome,
        whyBought: parsed.whyBought,
        whyLost: parsed.whyLost,
        improvements: parsed.improvements,
        aiSummary: parsed.summary,
        analyzedAt: new Date(),
      },
      update: {
        outcome,
        whyBought: parsed.whyBought,
        whyLost: parsed.whyLost,
        improvements: parsed.improvements,
        aiSummary: parsed.summary,
        analyzedAt: new Date(),
      },
    });

    return {
      dealId,
      outcome: row.outcome as AvitoDealAnalysisDto['outcome'],
      whyBought: row.whyBought,
      whyLost: row.whyLost,
      improvements: row.improvements as string[],
      aiSummary: row.aiSummary,
      analyzedAt: row.analyzedAt.toISOString(),
    };
  }
}
