import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { AvitoLeadDto, AvitoPipelineStage } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastEngine } from '../intelligence/forecast/forecast.engine';

import { AvitoFollowUpEngineService } from './avito-followup-engine.service';

@Injectable()
export class AvitoLeadCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastEngine,
    private readonly followUp: AvitoFollowUpEngineService,
  ) {}

  async list(tenantId: string, pipelineStage?: string): Promise<AvitoLeadDto[]> {
    const rows = await this.prisma.avitoLeadReadModel.findMany({
      where: { tenantId, ...(pipelineStage ? { pipelineStage } : {}) },
      orderBy: { lastActivityAt: 'desc' },
      take: 500,
    });
    return rows.map((r) => this.toDto(r));
  }

  async get(tenantId: string, leadId: string): Promise<AvitoLeadDto | null> {
    const r = await this.prisma.avitoLeadReadModel.findFirst({ where: { id: leadId, tenantId } });
    return r ? this.toDto(r) : null;
  }

  async ensureFromMessage(
    tenantId: string,
    input: {
      accountId: string;
      customerId: string;
      customerName: string;
      phone: string | null;
      adId: string | null;
      adTitle: string | null;
      conversationId: string | null;
      source: string;
      cityId: string | null;
      regionId: string | null;
    },
  ) {
    const existing = await this.prisma.avitoLeadReadModel.findFirst({
      where: { tenantId, customerId: input.customerId, adId: input.adId ?? undefined },
    });

    const now = new Date();
    const customer = await this.prisma.customerReadModel.findFirst({ where: { id: input.customerId, tenantId } });
    const aiScore = customer?.aiScore ?? 0;
    const purchaseProbability = customer?.purchaseProbability ?? 0.3;
    let forecastStr: string | null = null;
    try {
      const f = await this.forecast.forecast(tenantId, 'customer', input.customerId);
      forecastStr = f.forecasts[0]?.trend ?? 'stable';
    } catch {
      forecastStr = 'stable';
    }

    if (existing) {
      return this.prisma.avitoLeadReadModel.update({
        where: { id: existing.id },
        data: {
          lastActivityAt: now,
          conversationId: input.conversationId ?? existing.conversationId,
          aiScore,
          purchaseProbability,
          forecast: forecastStr,
        },
      });
    }

    return this.prisma.avitoLeadReadModel.create({
      data: {
        id: uuid(),
        tenantId,
        customerId: input.customerId,
        customerName: input.customerName,
        phone: input.phone,
        accountId: input.accountId,
        adId: input.adId,
        adTitle: input.adTitle,
        source: input.source,
        cityId: input.cityId,
        regionId: input.regionId,
        pipelineStage: 'new',
        dealStage: 'lead',
        aiScore,
        purchaseProbability,
        forecast: forecastStr,
        conversationId: input.conversationId,
        lastActivityAt: now,
        createdAt: now,
      },
    }).then(async (lead) => {
      await this.followUp.seedForLead(tenantId, lead.id, input.customerId);
      return lead;
    });
  }

  async moveStage(tenantId: string, leadId: string, stage: AvitoPipelineStage) {
    const dealStageMap: Record<string, string> = {
      new: 'lead',
      in_progress: 'interested',
      waiting: 'interested',
      negotiation: 'negotiation',
      offer: 'offer',
      reserved: 'reserved',
      sale: 'paid',
      repeat: 'completed',
      closed: 'cancelled',
    };
    return this.prisma.avitoLeadReadModel.update({
      where: { id: leadId },
      data: { pipelineStage: stage, dealStage: dealStageMap[stage] ?? 'lead', lastActivityAt: new Date() },
    });
  }

  private toDto(r: {
    id: string;
    customerId: string;
    customerName: string;
    phone: string | null;
    accountId: string | null;
    adId: string | null;
    adTitle: string | null;
    source: string;
    cityId: string | null;
    regionId: string | null;
    pipelineStage: string;
    dealStage: string;
    assigneeId: string | null;
    assigneeName: string | null;
    aiScore: number;
    purchaseProbability: number;
    forecast: string | null;
    conversationId: string | null;
    dealId: string | null;
    lastActivityAt: Date | null;
  }): AvitoLeadDto {
    return {
      id: r.id,
      customerId: r.customerId,
      customerName: r.customerName,
      phone: r.phone,
      accountId: r.accountId,
      adId: r.adId,
      adTitle: r.adTitle,
      source: r.source,
      cityId: r.cityId,
      regionId: r.regionId,
      pipelineStage: r.pipelineStage as AvitoPipelineStage,
      dealStage: r.dealStage,
      assigneeId: r.assigneeId,
      assigneeName: r.assigneeName,
      aiScore: r.aiScore,
      purchaseProbability: r.purchaseProbability,
      forecast: r.forecast,
      lastActivityAt: r.lastActivityAt?.toISOString() ?? null,
      conversationId: r.conversationId,
      dealId: r.dealId,
    };
  }
}
