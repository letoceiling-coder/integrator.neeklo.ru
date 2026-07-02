import { Injectable } from '@nestjs/common';
import type { AiRunRequestDto } from '@neeklo/contracts';
import { KnowledgeGraphV2Service } from '../../intelligence/knowledge-graph/knowledge-graph-v2.service';
import { ForecastEngine } from '../../intelligence/forecast/forecast.engine';
import { DecisionEngine } from '../../intelligence/decision/decision.engine';
import { RecommendationEngine } from '../../marketplace-core/recommendation/recommendation.engine';
import { MetricsWarehouseEngine } from '../../intelligence/warehouse/metrics-warehouse.engine';
import { StrategyEngine } from '../../intelligence/strategy/strategy.engine';
import { AiMemoryEngine } from '../../intelligence/memory/ai-memory.engine';

/**
 * Reasoning Engine — synthesizes intelligence layer context without calling LLMs.
 */
@Injectable()
export class ReasoningEngine {
  constructor(
    private readonly knowledgeGraph: KnowledgeGraphV2Service,
    private readonly forecast: ForecastEngine,
    private readonly decision: DecisionEngine,
    private readonly recommendations: RecommendationEngine,
    private readonly metrics: MetricsWarehouseEngine,
    private readonly strategy: StrategyEngine,
    private readonly memory: AiMemoryEngine,
  ) {}

  async buildContext(tenantId: string, request: AiRunRequestDto): Promise<string> {
    const parts: string[] = [];
    const entityType = (request.context.entityType as string) ?? null;
    const entityId = (request.context.entityId as string) ?? null;

    if (entityType && entityId) {
      const kg = await this.knowledgeGraph.getContext(tenantId, entityType, entityId, 2);
      if (kg.nodes.length) parts.push(`Knowledge Graph: ${kg.nodes.length} related entities`);

      const mem = await this.memory.buildContext(tenantId, entityType, entityId);
      if (mem) parts.push(mem);

      if (entityType === 'ad') {
        const fc = await this.forecast.getLatest(tenantId, 'ad', entityId);
        if (fc) parts.push(`Forecast (${fc.algorithm}): available`);
        const metrics = await this.metrics.syncFromHistorical(tenantId, 'ad', entityId);
        if (metrics) parts.push(`ROI: ${(metrics.roi * 100).toFixed(1)}%, CTR: ${(metrics.ctr * 100).toFixed(2)}%`);
        const decisions = await this.decision.listPending(tenantId, 'ad', entityId);
        if (decisions.length) parts.push(`Pending decisions: ${decisions.map((d) => d.action).join(', ')}`);
      }
    }

    const { strategy: activeStrategy } = await this.strategy.getActiveStrategy(tenantId);
    parts.push(`Active strategy: ${activeStrategy}`);

    const recs = await this.recommendations.listPending(tenantId);
    if (recs.length) parts.push(`Open recommendations: ${recs.length}`);

    return parts.length ? `[Reasoning Context]\n${parts.join('\n')}` : '';
  }
}
