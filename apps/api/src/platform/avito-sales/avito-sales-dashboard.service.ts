import { Injectable } from '@nestjs/common';
import type { AvitoSalesDashboardDto } from '@neeklo/contracts';
import { DealStage } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetCenterService } from '../commerce/commerce-services';

@Injectable()
export class AvitoSalesDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budget: BudgetCenterService,
  ) {}

  async getExecutive(tenantId: string): Promise<AvitoSalesDashboardDto> {
    const [leads, deals, budget] = await Promise.all([
      this.prisma.avitoLeadReadModel.count({ where: { tenantId } }),
      this.prisma.dealReadModel.findMany({ where: { tenantId } }),
      this.budget.getSummary(tenantId),
    ]);

    const won = deals.filter((d) => d.stage === DealStage.PAID || d.stage === DealStage.COMPLETED);
    const lost = deals.filter((d) => d.stage === DealStage.CANCELLED);
    const totalSales = won.reduce((s, d) => s + (d.actualAmount ?? d.expectedAmount), 0);
    const avgCheck = won.length ? Math.round(totalSales / won.length) : 0;
    const conversionRate = leads > 0 ? won.length / leads : 0;

    const stages = ['new', 'in_progress', 'negotiation', 'offer', 'reserved', 'sale', 'closed'];
    const pipelineLeads = await this.prisma.avitoLeadReadModel.groupBy({
      by: ['pipelineStage'],
      where: { tenantId },
      _count: true,
    });
    const funnel = stages.map((stage) => ({
      stage,
      count: pipelineLeads.find((p) => p.pipelineStage === stage)?._count ?? 0,
    }));

    return {
      conversionRate,
      totalSales,
      avgCheck,
      leadsCount: leads,
      lostCount: lost.length,
      funnel,
      roi: budget.roi,
      forecast: totalSales > budget.totalSpend ? 'up' : 'stable',
      aiRecommendations: [
        lost.length > won.length ? 'Улучшить работу с возражениями на этапе переговоров' : 'Масштабировать успешные сделки',
        leads > 10 && conversionRate < 0.1 ? 'Проверить качество лидов из Avito Messenger' : 'Поддерживать текущий темп',
      ],
    };
  }
}
