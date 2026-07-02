import { Injectable } from '@nestjs/common';
import type { StoredEvent } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';

/** All metric names computed by the platform — single source of truth for formulas. */
export const MetricName = {
  CTR: 'ctr',
  ROI: 'roi',
  ROAS: 'roas',
  CONVERSION: 'conversion',
  ENGAGEMENT: 'engagement',
  COST: 'cost',
  CPA: 'cpa',
  CPC: 'cpc',
  CPM: 'cpm',
  LTV: 'ltv',
  RESPONSE_TIME: 'response_time',
  AI_SCORE: 'ai_score',
  FORECAST_SCORE: 'forecast_score',
  REGIONAL_SCORE: 'regional_score',
  COMPETITION_SCORE: 'competition_score',
  POPULARITY_SCORE: 'popularity_score',
  MEDIA_SCORE: 'media_score',
  LISTING_SCORE: 'listing_score',
} as const;

export type MetricName = (typeof MetricName)[keyof typeof MetricName];

export interface MetricInput {
  views: number;
  contacts: number;
  spend: number;
  revenue: number;
  favorites: number;
  messages: number;
  responseTimeMs?: number;
  aiScore?: number;
}

export interface ComputedMetrics {
  [MetricName.CTR]: number;
  [MetricName.ROI]: number;
  [MetricName.ROAS]: number;
  [MetricName.CONVERSION]: number;
  [MetricName.ENGAGEMENT]: number;
  [MetricName.CPA]: number;
  [MetricName.CPC]: number;
  [MetricName.CPM]: number;
  [MetricName.RESPONSE_TIME]: number;
  [MetricName.AI_SCORE]: number;
}

/**
 * Metrics Engine — all derived metric calculations live here, never in UI or projections directly.
 * Projections may call this engine to stay consistent.
 */
@Injectable()
export class MetricsEngine {
  constructor(private readonly prisma: PrismaService) {}

  compute(input: MetricInput): ComputedMetrics {
    const { views, contacts, spend, revenue, favorites, messages, responseTimeMs = 0, aiScore = 0 } = input;
    return {
      [MetricName.CTR]: views > 0 ? contacts / views : 0,
      [MetricName.ROI]: spend > 0 ? (revenue - spend) / spend : 0,
      [MetricName.ROAS]: spend > 0 ? revenue / spend : 0,
      [MetricName.CONVERSION]: contacts > 0 ? Math.min(1, revenue > 0 ? 1 / contacts : 0) : 0,
      [MetricName.ENGAGEMENT]: views > 0 ? (favorites + messages) / views : 0,
      [MetricName.CPA]: contacts > 0 ? spend / contacts : 0,
      [MetricName.CPC]: contacts > 0 ? spend / contacts : 0,
      [MetricName.CPM]: views > 0 ? (spend / views) * 1000 : 0,
      [MetricName.RESPONSE_TIME]: responseTimeMs,
      [MetricName.AI_SCORE]: aiScore,
    };
  }

  /** Persist computed metrics for an entity (append-only snapshots). */
  async persist(
    tenantId: string,
    entityType: string,
    entityId: string,
    metrics: Partial<ComputedMetrics>,
    dimensions: Record<string, string> = {},
  ): Promise<void> {
    const at = new Date();
    await this.prisma.metricSnapshot.createMany({
      data: Object.entries(metrics).map(([metricName, value]) => ({
        tenantId,
        entityType,
        entityId,
        metricName,
        value: value ?? 0,
        dimensions,
        computedAt: at,
      })),
    });
  }

  /** Recompute ad metrics from read model counters. */
  computeForAd(row: {
    views: number;
    contacts: number;
    spendAmount: number;
    revenueAmount: number;
    favorites: number;
    messages: number;
    aiScore: number | null;
  }): ComputedMetrics {
    return this.compute({
      views: row.views,
      contacts: row.contacts,
      spend: row.spendAmount,
      revenue: row.revenueAmount,
      favorites: row.favorites,
      messages: row.messages,
      aiScore: row.aiScore ?? 0,
    });
  }

  async getLatest(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<Record<string, number>> {
    const rows = await this.prisma.metricSnapshot.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { computedAt: 'desc' },
      take: 50,
    });
    const result: Record<string, number> = {};
    for (const row of rows) {
      if (!(row.metricName in result)) result[row.metricName] = row.value;
    }
    return result;
  }
}
