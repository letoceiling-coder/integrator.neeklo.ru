import { Injectable } from '@nestjs/common';
import { StrategyType } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';

export interface StrategyWeights {
  profit: number;
  sales: number;
  roi: number;
  budget: number;
  speed: number;
  retention: number;
  expansion: number;
}

const PRESETS: Record<StrategyType, StrategyWeights> = {
  [StrategyType.MAX_PROFIT]: { profit: 1, sales: 0.3, roi: 0.8, budget: 0.2, speed: 0.2, retention: 0.3, expansion: 0.2 },
  [StrategyType.MAX_SALES]: { profit: 0.3, sales: 1, roi: 0.4, budget: 0.5, speed: 0.6, retention: 0.5, expansion: 0.4 },
  [StrategyType.MIN_BUDGET]: { profit: 0.5, sales: 0.2, roi: 1, budget: 1, speed: 0.1, retention: 0.3, expansion: 0.1 },
  [StrategyType.MAX_ROI]: { profit: 0.7, sales: 0.3, roi: 1, budget: 0.6, speed: 0.2, retention: 0.3, expansion: 0.2 },
  [StrategyType.FAST_SALE]: { profit: 0.4, sales: 0.8, roi: 0.5, budget: 0.4, speed: 1, retention: 0.2, expansion: 0.3 },
  [StrategyType.RETENTION]: { profit: 0.5, sales: 0.5, roi: 0.4, budget: 0.3, speed: 0.3, retention: 1, expansion: 0.2 },
  [StrategyType.REGION_EXPANSION]: { profit: 0.4, sales: 0.6, roi: 0.5, budget: 0.5, speed: 0.4, retention: 0.4, expansion: 1 },
};

/**
 * Strategy Engine — weights decision priorities per tenant strategy profile.
 */
@Injectable()
export class StrategyEngine {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveStrategy(tenantId: string): Promise<{ strategy: StrategyType; weights: StrategyWeights }> {
    const row = await this.prisma.strategyReadModel.findUnique({ where: { tenantId } });
    const strategy = (row?.strategy as StrategyType) ?? StrategyType.MAX_ROI;
    const weights = (row?.weights as StrategyWeights) ?? PRESETS[strategy];
    return { strategy, weights };
  }

  async setStrategy(tenantId: string, strategy: StrategyType): Promise<void> {
    const weights = PRESETS[strategy];
    await this.prisma.strategyReadModel.upsert({
      where: { tenantId },
      create: { tenantId, strategy, weights, active: true, updatedAt: new Date() },
      update: { strategy, weights, active: true, updatedAt: new Date() },
    });
  }

  scoreAction(action: string, weights: StrategyWeights, signals: Record<string, number>): number {
    const actionScores: Record<string, number> = {
      boost: signals.speed * weights.speed + signals.sales * weights.sales,
      change_price: signals.roi * weights.roi + signals.profit * weights.profit,
      add_photos: signals.sales * weights.sales * 0.8,
      replace_cover: signals.sales * weights.sales * 0.7,
      rewrite_description: signals.sales * weights.sales * 0.6,
      stop_promotion: signals.budget * weights.budget,
      increase_budget: signals.sales * weights.sales * 0.5,
      reallocate_budget: signals.roi * weights.roi,
      add_region: signals.expansion * weights.expansion,
      remove_region: signals.budget * weights.budget * 0.5,
    };
    return actionScores[action] ?? 0;
  }
}
