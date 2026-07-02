import { Global, Module } from '@nestjs/common';
import { IntelligenceEventPublisher } from './events/intelligence-event.publisher';
import { HistoricalWarehouseEngine } from './warehouse/historical-warehouse.engine';
import { MetricsWarehouseEngine } from './warehouse/metrics-warehouse.engine';
import { FORECAST_PROVIDER } from './forecast/forecast.provider';
import { TimeSeriesForecastProvider } from './forecast/time-series.provider';
import { ForecastEngine } from './forecast/forecast.engine';
import { StrategyEngine } from './strategy/strategy.engine';
import { DecisionEngine } from './decision/decision.engine';
import { RegionalIntelligenceEngine } from './regional/regional-intelligence.engine';
import { CompetitorIntelligenceEngine } from './competitor/competitor-intelligence.engine';
import { OpportunityEngine } from './opportunity/opportunity.engine';
import { ExperimentEngine } from './experiment/experiment.engine';
import { AiMemoryEngine } from './memory/ai-memory.engine';
import { KnowledgeGraphV2Service } from './knowledge-graph/knowledge-graph-v2.service';
import { IntelligencePipelineService } from './pipeline/intelligence-pipeline.service';
import { IntelligenceObservabilityService } from './observability/intelligence-observability.service';

@Global()
@Module({
  providers: [
    IntelligenceEventPublisher,
    HistoricalWarehouseEngine,
    MetricsWarehouseEngine,
    { provide: FORECAST_PROVIDER, useClass: TimeSeriesForecastProvider },
    ForecastEngine,
    StrategyEngine,
    DecisionEngine,
    RegionalIntelligenceEngine,
    CompetitorIntelligenceEngine,
    OpportunityEngine,
    ExperimentEngine,
    AiMemoryEngine,
    KnowledgeGraphV2Service,
    IntelligencePipelineService,
    IntelligenceObservabilityService,
  ],
  exports: [
    IntelligenceEventPublisher,
    HistoricalWarehouseEngine,
    MetricsWarehouseEngine,
    ForecastEngine,
    StrategyEngine,
    DecisionEngine,
    RegionalIntelligenceEngine,
    CompetitorIntelligenceEngine,
    OpportunityEngine,
    ExperimentEngine,
    AiMemoryEngine,
    KnowledgeGraphV2Service,
    IntelligencePipelineService,
    IntelligenceObservabilityService,
  ],
})
export class IntelligenceModule {}
