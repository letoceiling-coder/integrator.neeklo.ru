import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { IntelligenceEventType } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelligenceEventPublisher } from '../events/intelligence-event.publisher';

export type ExperimentDimension =
  | 'title'
  | 'description'
  | 'price'
  | 'photo'
  | 'video'
  | 'photo_order'
  | 'region'
  | 'category';

export interface ExperimentVariant {
  label: string;
  payload: Record<string, unknown>;
}

/**
 * Experiment Engine — A/B, A/B/C, and multivariate tests with automatic significance analysis.
 */
@Injectable()
export class ExperimentEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: IntelligenceEventPublisher,
  ) {}

  async create(
    tenantId: string,
    name: string,
    targetEntityType: string,
    targetEntityId: string,
    dimension: ExperimentDimension,
    variants: ExperimentVariant[],
  ): Promise<{ id: string }> {
    const id = uuid();
    await this.prisma.experimentReadModel.create({
      data: {
        id,
        tenantId,
        name,
        targetEntityType,
        targetEntityId,
        dimension,
        status: 'draft',
        variantCount: variants.length,
        variants: {
          create: variants.map((v) => ({
            label: v.label,
            payload: v.payload,
          })),
        },
      },
    });
    return { id };
  }

  async start(tenantId: string, experimentId: string): Promise<void> {
    const exp = await this.prisma.experimentReadModel.findFirstOrThrow({
      where: { id: experimentId, tenantId },
      include: { variants: true },
    });

    await this.prisma.experimentReadModel.update({
      where: { id: experimentId },
      data: { status: 'running', startedAt: new Date() },
    });

    await this.publisher.publish(tenantId, `experiments:${experimentId}`, IntelligenceEventType.ExperimentStarted, {
      experimentId,
      name: exp.name,
      variantCount: exp.variantCount,
      targetEntityType: exp.targetEntityType,
      targetEntityId: exp.targetEntityId,
      startedAt: new Date().toISOString(),
    });
  }

  async recordImpression(experimentId: string, variantId: string): Promise<void> {
    await this.prisma.experimentVariantRow.update({
      where: { id: variantId },
      data: { impressions: { increment: 1 } },
    });
  }

  async recordConversion(variantId: string, revenue = 0): Promise<void> {
    await this.prisma.experimentVariantRow.update({
      where: { id: variantId },
      data: { conversions: { increment: 1 }, revenue: { increment: revenue } },
    });
  }

  async analyze(tenantId: string, experimentId: string): Promise<{ winnerVariantId: string | null; significance: number }> {
    const exp = await this.prisma.experimentReadModel.findFirstOrThrow({
      where: { id: experimentId, tenantId },
      include: { variants: true },
    });

    if (exp.variants.length < 2) return { winnerVariantId: null, significance: 0 };

    const scored = exp.variants.map((v) => ({
      id: v.id,
      rate: v.impressions > 0 ? v.conversions / v.impressions : 0,
      impressions: v.impressions,
    }));

    scored.sort((a, b) => b.rate - a.rate);
    const winner = scored[0]!;
    const runner = scored[1]!;

    const pooledRate = (winner.rate * winner.impressions + runner.rate * runner.impressions) / Math.max(1, winner.impressions + runner.impressions);
    const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / Math.max(1, winner.impressions) + 1 / Math.max(1, runner.impressions)));
    const z = se > 0 ? Math.abs(winner.rate - runner.rate) / se : 0;
    const significance = Math.min(0.99, z / 2.576);

    await this.prisma.experimentReadModel.update({
      where: { id: experimentId },
      data: {
        status: 'completed',
        winnerVariantId: significance > 0.9 ? winner.id : null,
        significance,
        completedAt: new Date(),
      },
    });

    await this.publisher.publish(tenantId, `experiments:${experimentId}`, IntelligenceEventType.ExperimentCompleted, {
      experimentId,
      winnerVariantId: significance > 0.9 ? winner.id : null,
      significance,
      completedAt: new Date().toISOString(),
    });

    return { winnerVariantId: significance > 0.9 ? winner.id : null, significance };
  }

  async list(tenantId: string) {
    return this.prisma.experimentReadModel.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      include: { variants: true },
    });
  }
}
