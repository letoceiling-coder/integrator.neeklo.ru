import { Injectable } from '@nestjs/common';
import type { AvitoCustomer360Dto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerQueryService } from '../../modules/customer/application/customer.service';
import { TimelineEngine } from '../commerce/commerce-services';
import { AvitoLeadCenterService } from './avito-lead-center.service';
import { ForecastEngine } from '../intelligence/forecast/forecast.engine';
import { AiMemoryEngine } from '../intelligence/memory/ai-memory.engine';

@Injectable()
export class AvitoCustomer360Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomerQueryService,
    private readonly leads: AvitoLeadCenterService,
    private readonly timeline: TimelineEngine,
    private readonly forecast: ForecastEngine,
    private readonly memory: AiMemoryEngine,
  ) {}

  async get360(tenantId: string, customerId: string): Promise<AvitoCustomer360Dto | null> {
    const base = await this.customers.get360(customerId, tenantId);
    if (!base) return null;

    const customerLeads = (await this.leads.list(tenantId)).filter((l) => l.customerId === customerId);
    const adIds = [...new Set(base.deals.map((d) => d.adId).filter(Boolean))] as string[];
    const ads = adIds.length
      ? await this.prisma.adReadModel.findMany({ where: { id: { in: adIds }, tenantId } })
      : [];

    const payments = base.deals
      .filter((d) => d.actualAmount != null)
      .map((d) => ({
        dealId: d.id,
        amount: d.actualAmount as number,
        at: (d.closedAt ?? d.updatedAt).toISOString(),
      }));

    let forecastStr: string | null = null;
    try {
      const f = await this.forecast.forecast(tenantId, 'customer', customerId);
      forecastStr = f.forecasts[0]?.trend ?? null;
    } catch {
      forecastStr = null;
    }

    let mem: unknown[] = [];
    try {
      mem = await this.memory.recall(tenantId, 'customer', customerId, undefined, 10);
    } catch {
      mem = [];
    }

    const tl = await this.timeline.getTimeline(tenantId, 'customer', customerId);

    const recommendations = base.deals
      .filter((d) => d.stage === 'negotiation' || d.stage === 'offer')
      .slice(0, 5)
      .map((d) => ({
        title: `Сделка: ${d.adTitle ?? d.id}`,
        detail: d.aiSuggestedStage ? `AI предлагает → ${d.aiSuggestedStage}` : 'Продолжить переговоры',
      }));

    return {
      customer: base as unknown as Record<string, unknown>,
      conversations: base.conversations,
      deals: base.deals,
      leads: customerLeads,
      timeline: tl,
      graph: base.graph,
      aiSummary: base.aiSummary,
      memory: mem,
      forecast: forecastStr,
      recommendations,
      ads,
      payments,
    };
  }
}
