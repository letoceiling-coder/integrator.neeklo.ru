import { Injectable } from '@nestjs/common';
import type { AvitoSalesAgentConfigDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvitoSalesAgentConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string, accountId: string): Promise<AvitoSalesAgentConfigDto> {
    const row = await this.prisma.avitoSalesAgentConfigReadModel.findUnique({
      where: { tenantId_accountId: { tenantId, accountId } },
    });
    if (!row) {
      return {
        accountId,
        enabled: true,
        workingHoursStart: 9,
        workingHoursEnd: 21,
        tone: 'professional',
        maxDiscountPct: 10,
        maxPriceRub: undefined,
        handoffToManager: true,
        useKnowledgeBase: true,
        useHistory: true,
        useCrm: true,
        useForecast: true,
        useDecisionEngine: true,
        useMemory: true,
      };
    }
    return {
      accountId: row.accountId,
      enabled: row.enabled,
      workingHoursStart: row.workingHoursStart,
      workingHoursEnd: row.workingHoursEnd,
      tone: row.tone as AvitoSalesAgentConfigDto['tone'],
      maxDiscountPct: row.maxDiscountPct,
      maxPriceRub: row.maxPriceRub ?? undefined,
      handoffToManager: row.handoffToManager,
      useKnowledgeBase: row.useKnowledgeBase,
      useHistory: row.useHistory,
      useCrm: row.useCrm,
      useForecast: row.useForecast,
      useDecisionEngine: row.useDecisionEngine,
      useMemory: row.useMemory,
    };
  }

  async upsert(tenantId: string, dto: AvitoSalesAgentConfigDto) {
    return this.prisma.avitoSalesAgentConfigReadModel.upsert({
      where: { tenantId_accountId: { tenantId, accountId: dto.accountId } },
      create: { tenantId, ...dto },
      update: { ...dto },
    });
  }

  isWithinWorkingHours(config: AvitoSalesAgentConfigDto): boolean {
    const hour = new Date().getHours();
    return hour >= config.workingHoursStart && hour < config.workingHoursEnd;
  }
}
