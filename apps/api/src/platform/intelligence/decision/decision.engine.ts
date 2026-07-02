import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  DecisionAction,
  IntelligenceEventType,
  StrategyType,
} from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelligenceEventPublisher } from '../events/intelligence-event.publisher';
import { ForecastEngine } from '../forecast/forecast.engine';
import { MetricsWarehouseEngine } from '../warehouse/metrics-warehouse.engine';
import { StrategyEngine } from '../strategy/strategy.engine';
import { KnowledgeGraphV2Service } from '../knowledge-graph/knowledge-graph-v2.service';
import type { ForecastPoint } from '../forecast/forecast.provider';

export interface Decision {
  id: string;
  action: string;
  confidence: number;
  reason: string;
  strategy: StrategyType;
  payload: Record<string, unknown>;
}

/**
 * Decision Engine — synthesizes metrics, forecasts, knowledge graph, and strategy into actionable decisions.
 * Every decision is persisted and emitted as a domain event.
 */
@Injectable()
export class DecisionEngine {
  private readonly logger = new Logger(DecisionEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: IntelligenceEventPublisher,
    private readonly forecast: ForecastEngine,
    private readonly metricsWarehouse: MetricsWarehouseEngine,
    private readonly strategy: StrategyEngine,
    private readonly knowledgeGraph: KnowledgeGraphV2Service,
  ) {}

  async decide(tenantId: string, entityType: string, entityId: string): Promise<Decision[]> {
    const { strategy: activeStrategy, weights } = await this.strategy.getActiveStrategy(tenantId);
    const metrics = await this.metricsWarehouse.syncFromHistorical(tenantId, entityType, entityId);
    const forecastResult = await this.forecast.forecast(tenantId, entityType, entityId, 7);
    await this.knowledgeGraph.getContext(tenantId, entityType, entityId, 2);

    const signals = this.buildSignals(metrics, forecastResult.forecasts);
    const candidates = this.buildCandidates(metrics, forecastResult.forecasts);
    const decisions: Decision[] = [];

    for (const candidate of candidates) {
      const score = this.strategy.scoreAction(candidate.action, weights, signals);
      if (score < 0.3) continue;

      const decision: Decision = {
        id: uuid(),
        action: candidate.action,
        confidence: Math.min(0.95, score),
        reason: candidate.reason,
        strategy: activeStrategy,
        payload: candidate.payload,
      };

      await this.prisma.decisionReadModel.create({
        data: {
          id: decision.id,
          tenantId,
          entityType,
          entityId,
          action: decision.action,
          strategy: activeStrategy,
          confidence: decision.confidence,
          reason: decision.reason,
          payload: decision.payload,
          status: 'pending',
          generatedAt: new Date(),
        },
      });

      await this.publisher.publish(
        tenantId,
        this.publisher.streamKey(tenantId, entityType, entityId),
        IntelligenceEventType.DecisionMade,
        {
          entityType,
          entityId,
          action: decision.action,
          strategy: activeStrategy,
          confidence: decision.confidence,
          reason: decision.reason,
          payload: decision.payload,
          generatedAt: new Date().toISOString(),
        },
      );

      decisions.push(decision);
    }

    return decisions.sort((a, b) => b.confidence - a.confidence);
  }

  async apply(decisionId: string, tenantId: string): Promise<void> {
    await this.prisma.decisionReadModel.update({
      where: { id: decisionId },
      data: { status: 'applied', resolvedAt: new Date() },
    });
    await this.publisher.publish(tenantId, `decisions:${tenantId}`, IntelligenceEventType.DecisionApplied, {
      decisionId,
      appliedAt: new Date().toISOString(),
    });
  }

  async dismiss(decisionId: string, tenantId: string, reason: string | null): Promise<void> {
    await this.prisma.decisionReadModel.update({
      where: { id: decisionId },
      data: { status: 'dismissed', resolvedAt: new Date() },
    });
    await this.publisher.publish(tenantId, `decisions:${tenantId}`, IntelligenceEventType.DecisionDismissed, {
      decisionId,
      reason,
      dismissedAt: new Date().toISOString(),
    });
  }

  async listPending(tenantId: string, entityType?: string, entityId?: string) {
    return this.prisma.decisionReadModel.findMany({
      where: {
        tenantId,
        status: 'pending',
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { confidence: 'desc' },
      take: 50,
    });
  }

  private buildSignals(
    metrics: Awaited<ReturnType<MetricsWarehouseEngine['syncFromHistorical']>>,
    forecasts: ForecastPoint[],
  ): Record<string, number> {
    const viewsForecast = forecasts.find((f) => f.metric === 'views');
    return {
      profit: metrics?.roi ?? 0,
      sales: metrics?.conversion ?? 0,
      roi: metrics?.roi ?? 0,
      budget: metrics ? metrics.cost / Math.max(1, metrics.revenue) : 0,
      speed: viewsForecast?.trend === 'falling' ? 0.8 : 0.2,
      retention: metrics?.engagement ?? 0,
      expansion: metrics?.opportunityScore ?? 0,
    };
  }

  private buildCandidates(
    metrics: Awaited<ReturnType<MetricsWarehouseEngine['syncFromHistorical']>>,
    forecasts: ForecastPoint[],
  ): { action: string; reason: string; payload: Record<string, unknown> }[] {
    if (!metrics) return [];
    const candidates: { action: string; reason: string; payload: Record<string, unknown> }[] = [];

    const viewsF = forecasts.find((f) => f.metric === 'views');
    if (viewsF?.trend === 'falling') {
      candidates.push({ action: DecisionAction.BOOST, reason: 'Прогноз падения просмотров', payload: {} });
    }
    if (metrics.roi < 0 && metrics.cost > 0) {
      candidates.push({ action: DecisionAction.CHANGE_PRICE, reason: 'Отрицательный ROI', payload: { direction: 'decrease' } });
    }
    if (metrics.ctr < 0.02 && metrics.views > 50) {
      candidates.push({ action: DecisionAction.REPLACE_COVER, reason: 'Низкий CTR', payload: {} });
      candidates.push({ action: DecisionAction.REWRITE_DESCRIPTION, reason: 'Низкая конверсия текста', payload: {} });
    }
    if (metrics.cost > metrics.revenue * 0.5) {
      candidates.push({ action: DecisionAction.STOP_PROMOTION, reason: 'Расходы превышают 50% выручки', payload: {} });
    }
    if (metrics.opportunityScore > 0.5) {
      candidates.push({ action: DecisionAction.INCREASE_BUDGET, reason: 'Высокий opportunity score', payload: {} });
    }

    return candidates;
  }
}
