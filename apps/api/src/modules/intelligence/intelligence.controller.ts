import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Granularity, Permission, StrategyType } from '@neeklo/contracts';
import type { CurrentUser as CurrentUserDto } from '@neeklo/contracts';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ForecastEngine } from '../../platform/intelligence/forecast/forecast.engine';
import { DecisionEngine } from '../../platform/intelligence/decision/decision.engine';
import { OpportunityEngine } from '../../platform/intelligence/opportunity/opportunity.engine';
import { RegionalIntelligenceEngine } from '../../platform/intelligence/regional/regional-intelligence.engine';
import { CompetitorIntelligenceEngine } from '../../platform/intelligence/competitor/competitor-intelligence.engine';
import { StrategyEngine } from '../../platform/intelligence/strategy/strategy.engine';
import { MetricsWarehouseEngine } from '../../platform/intelligence/warehouse/metrics-warehouse.engine';
import { HistoricalWarehouseEngine } from '../../platform/intelligence/warehouse/historical-warehouse.engine';
import { ExperimentEngine } from '../../platform/intelligence/experiment/experiment.engine';
import { KnowledgeGraphV2Service } from '../../platform/intelligence/knowledge-graph/knowledge-graph-v2.service';
import { AiMemoryEngine } from '../../platform/intelligence/memory/ai-memory.engine';
import { IntelligenceObservabilityService } from '../../platform/intelligence/observability/intelligence-observability.service';
import { RecommendationEngine } from '../../platform/marketplace-core/recommendation/recommendation.engine';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Controller('intelligence')
export class IntelligenceController {
  constructor(
    private readonly forecast: ForecastEngine,
    private readonly decision: DecisionEngine,
    private readonly opportunity: OpportunityEngine,
    private readonly regional: RegionalIntelligenceEngine,
    private readonly competitor: CompetitorIntelligenceEngine,
    private readonly strategy: StrategyEngine,
    private readonly metricsWarehouse: MetricsWarehouseEngine,
    private readonly historical: HistoricalWarehouseEngine,
    private readonly experiments: ExperimentEngine,
    private readonly knowledgeGraph: KnowledgeGraphV2Service,
    private readonly memory: AiMemoryEngine,
    private readonly observability: IntelligenceObservabilityService,
    private readonly recommendations: RecommendationEngine,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  @RequirePermissions(Permission.AnalyticsRead)
  async dashboard(@CurrentUser() user: CurrentUserDto) {
    const [decisions, opportunities, regions, strategy] = await Promise.all([
      this.decision.listPending(user.tenantId),
      this.opportunity.listOpen(user.tenantId),
      this.regional.list(user.tenantId, 5),
      this.strategy.getActiveStrategy(user.tenantId),
    ]);
    return {
      pendingDecisions: decisions.length,
      openOpportunities: opportunities.length,
      topRegions: regions,
      strategy: strategy.strategy,
      pipeline: await this.observability.getPipelineHealth(),
    };
  }

  @Get('forecast')
  @RequirePermissions(Permission.AnalyticsRead)
  async getForecast(
    @CurrentUser() user: CurrentUserDto,
    @Query('entityType') entityType = 'ad',
    @Query('entityId') entityId: string,
    @Query('horizonDays') horizonDays = '7',
  ) {
    if (!entityId) {
      const latest = await this.prisma.forecastSnapshot.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { generatedAt: 'desc' },
        take: 10,
      });
      return { forecasts: latest };
    }
    return this.forecast.forecast(user.tenantId, entityType, entityId, Number(horizonDays));
  }

  @Get('opportunities')
  @RequirePermissions(Permission.AnalyticsRead)
  async opportunities(@CurrentUser() user: CurrentUserDto) {
    return this.opportunity.listOpen(user.tenantId);
  }

  @Post('opportunities/scan')
  @RequirePermissions(Permission.AnalyticsRead)
  scanOpportunities(@CurrentUser() user: CurrentUserDto) {
    return this.opportunity.scan(user.tenantId);
  }

  @Get('recommendations')
  @RequirePermissions(Permission.AnalyticsRead)
  recommendations(@CurrentUser() user: CurrentUserDto) {
    return this.recommendations.listPending(user.tenantId);
  }

  @Get('regions')
  @RequirePermissions(Permission.AnalyticsRead)
  async regions(@CurrentUser() user: CurrentUserDto) {
    await this.regional.refresh(user.tenantId);
    return this.regional.list(user.tenantId);
  }

  @Get('regions/:regionId')
  @RequirePermissions(Permission.AnalyticsRead)
  region(@CurrentUser() user: CurrentUserDto, @Param('regionId') regionId: string) {
    return this.regional.get(user.tenantId, regionId);
  }

  @Get('competition')
  @RequirePermissions(Permission.AnalyticsRead)
  competition(
    @CurrentUser() user: CurrentUserDto,
    @Query('adId') adId: string,
  ) {
    return this.competitor.analyze(user.tenantId, adId);
  }

  @Get('strategy')
  @RequirePermissions(Permission.AnalyticsRead)
  getStrategy(@CurrentUser() user: CurrentUserDto) {
    return this.strategy.getActiveStrategy(user.tenantId);
  }

  @Post('strategy')
  @RequirePermissions(Permission.SettingsWrite)
  setStrategy(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: { strategy: StrategyType },
  ) {
    return this.strategy.setStrategy(user.tenantId, body.strategy);
  }

  @Get('metrics')
  @RequirePermissions(Permission.AnalyticsRead)
  metrics(
    @CurrentUser() user: CurrentUserDto,
    @Query('entityType') entityType = 'ad',
    @Query('entityId') entityId: string,
    @Query('granularity') granularity: Granularity = Granularity.DAY,
  ) {
    return this.metricsWarehouse.query(user.tenantId, entityType, entityId, granularity);
  }

  @Get('history')
  @RequirePermissions(Permission.AnalyticsRead)
  history(
    @CurrentUser() user: CurrentUserDto,
    @Query('entityType') entityType = 'ad',
    @Query('entityId') entityId: string,
    @Query('granularity') granularity: Granularity = Granularity.DAY,
    @Query('limit') limit = '90',
  ) {
    return this.historical.getHistory(user.tenantId, entityType, entityId, granularity, Number(limit));
  }

  @Get('experiments')
  @RequirePermissions(Permission.AnalyticsRead)
  experiments(@CurrentUser() user: CurrentUserDto) {
    return this.experiments.list(user.tenantId);
  }

  @Post('experiments')
  @RequirePermissions(Permission.AdWrite)
  createExperiment(
    @CurrentUser() user: CurrentUserDto,
    @Body()
    body: {
      name: string;
      targetEntityType: string;
      targetEntityId: string;
      dimension: string;
      variants: { label: string; payload: Record<string, unknown> }[];
    },
  ) {
    return this.experiments.create(
      user.tenantId,
      body.name,
      body.targetEntityType,
      body.targetEntityId,
      body.dimension as Parameters<ExperimentEngine['create']>[4],
      body.variants,
    );
  }

  @Get('graph/:kind/:entityId')
  @RequirePermissions(Permission.AnalyticsRead)
  graph(
    @CurrentUser() user: CurrentUserDto,
    @Param('kind') kind: string,
    @Param('entityId') entityId: string,
    @Query('depth') depth = '2',
  ) {
    return this.knowledgeGraph.getContext(user.tenantId, kind, entityId, Number(depth));
  }

  @Get('memory/:subjectKind/:subjectId')
  @RequirePermissions(Permission.AnalyticsRead)
  memory(
    @CurrentUser() user: CurrentUserDto,
    @Param('subjectKind') subjectKind: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.memory.recall(user.tenantId, subjectKind, subjectId);
  }

  @Post('decisions/:id/apply')
  @RequirePermissions(Permission.AdWrite)
  applyDecision(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.decision.apply(id, user.tenantId);
  }

  @Post('decisions/:id/dismiss')
  @RequirePermissions(Permission.AdWrite)
  dismissDecision(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.decision.dismiss(id, user.tenantId, body.reason ?? null);
  }
}
