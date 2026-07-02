import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { IntelligenceEventType } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelligenceEventPublisher } from '../events/intelligence-event.publisher';

export interface CompetitorObservation {
  competitorId: string;
  externalId?: string;
  title: string;
  priceAmount: number;
  photoHash?: string;
  descriptionHash?: string;
  rank?: number;
  rating?: number;
}

/**
 * Competitor Intelligence Engine — tracks competitor listing changes over time.
 */
@Injectable()
export class CompetitorIntelligenceEngine {
  private readonly logger = new Logger(CompetitorIntelligenceEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: IntelligenceEventPublisher,
  ) {}

  async observe(
    tenantId: string,
    adId: string,
    observation: CompetitorObservation,
  ): Promise<void> {
    const last = await this.prisma.competitorSnapshot.findFirst({
      where: { tenantId, adId, competitorId: observation.competitorId },
      orderBy: { observedAt: 'desc' },
    });

    await this.prisma.competitorSnapshot.create({
      data: {
        tenantId,
        adId,
        competitorId: observation.competitorId,
        externalId: observation.externalId ?? null,
        title: observation.title,
        priceAmount: observation.priceAmount,
        photoHash: observation.photoHash ?? null,
        descriptionHash: observation.descriptionHash ?? null,
        rank: observation.rank ?? 0,
        rating: observation.rating ?? 0,
        observedAt: new Date(),
      },
    });

    if (!last) {
      await this.emitChange(tenantId, adId, observation.competitorId, 'appeared', { title: observation.title });
      return;
    }

    if (last.priceAmount !== observation.priceAmount) {
      await this.emitChange(tenantId, adId, observation.competitorId, 'price', {
        from: last.priceAmount,
        to: observation.priceAmount,
        delta: observation.priceAmount - last.priceAmount,
      });
    }
    if (last.photoHash && observation.photoHash && last.photoHash !== observation.photoHash) {
      await this.emitChange(tenantId, adId, observation.competitorId, 'photo', {});
    }
    if (last.descriptionHash && observation.descriptionHash && last.descriptionHash !== observation.descriptionHash) {
      await this.emitChange(tenantId, adId, observation.competitorId, 'description', {});
    }
    if (last.rank !== observation.rank) {
      await this.emitChange(tenantId, adId, observation.competitorId, 'rank', {
        from: last.rank,
        to: observation.rank,
      });
    }
  }

  async markDisappeared(tenantId: string, adId: string, competitorId: string): Promise<void> {
    await this.emitChange(tenantId, adId, competitorId, 'disappeared', {});
  }

  async analyze(tenantId: string, adId: string) {
    const snapshots = await this.prisma.competitorSnapshot.findMany({
      where: { tenantId, adId },
      orderBy: { observedAt: 'desc' },
      take: 500,
    });

    const byCompetitor = new Map<string, typeof snapshots>();
    for (const s of snapshots) {
      const list = byCompetitor.get(s.competitorId) ?? [];
      if (list.length < 10) list.push(s);
      byCompetitor.set(s.competitorId, list);
    }

    const insights = [];
    for (const [competitorId, history] of byCompetitor) {
      const latest = history[0]!;
      const oldest = history[history.length - 1]!;
      const priceDrop = oldest.priceAmount - latest.priceAmount;
      const isLeader = latest.rank === 1;
      const isDumper = priceDrop > oldest.priceAmount * 0.15;

      insights.push({
        competitorId,
        title: latest.title,
        isLeader,
        isDumper,
        priceTrend: priceDrop > 0 ? 'decreasing' : priceDrop < 0 ? 'increasing' : 'stable',
        latestPrice: latest.priceAmount,
        observations: history.length,
      });
    }

    return {
      total: byCompetitor.size,
      leaders: insights.filter((i) => i.isLeader),
      dumpers: insights.filter((i) => i.isDumper),
      insights,
    };
  }

  static hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private async emitChange(
    tenantId: string,
    adId: string,
    competitorId: string,
    changeType: 'price' | 'photo' | 'description' | 'promotion' | 'appeared' | 'disappeared' | 'rank',
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.publisher.publish(tenantId, `competitors:${adId}`, IntelligenceEventType.CompetitorChangeDetected, {
      adId,
      competitorId,
      changeType,
      details,
      detectedAt: new Date().toISOString(),
    });
  }
}
