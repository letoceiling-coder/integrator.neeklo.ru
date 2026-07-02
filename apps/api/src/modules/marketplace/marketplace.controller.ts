import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { MarketplaceCode, Permission } from '@neeklo/contracts';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { CurrentUser as CurrentUserDto } from '@neeklo/contracts';
import {
  MarketplaceService,
  MarketplaceSyncService,
  MarketplaceHealthService,
  MarketplaceCapabilityService,
  MarketplaceRecommendationService,
} from '../../platform/marketplace-core/services/marketplace.services';
import { MarketplaceRegistryService } from '../../platform/marketplace-core/registry/marketplace-registry.service';
import { KnowledgeGraphService } from '../../platform/marketplace-core/knowledge-graph/knowledge-graph.service';
import { AnalyticsEngine } from '../../platform/marketplace-core/analytics/analytics.engine';
import { ObservabilityService } from '../../platform/marketplace-core/observability/observability.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly sync: MarketplaceSyncService,
    private readonly health: MarketplaceHealthService,
    private readonly capabilities: MarketplaceCapabilityService,
    private readonly recommendations: MarketplaceRecommendationService,
    private readonly registry: MarketplaceRegistryService,
    private readonly knowledgeGraph: KnowledgeGraphService,
    private readonly analytics: AnalyticsEngine,
    private readonly observability: ObservabilityService,
  ) {}

  @Get('providers')
  @RequirePermissions(Permission.AdRead)
  listProviders() {
    return this.marketplace.listMarketplaces();
  }

  @Get('plugins')
  @RequirePermissions(Permission.SettingsWrite)
  listPlugins() {
    return this.registry.listPlugins().map((p) => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      kind: p.manifest.kind,
      state: p.state,
    }));
  }

  @Get('accounts')
  @RequirePermissions(Permission.AdRead)
  listAccounts(@CurrentUser() user: CurrentUserDto) {
    return this.marketplace.listAccounts(user.tenantId);
  }

  @Post('accounts')
  @RequirePermissions(Permission.SettingsWrite)
  createAccount(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: { marketplace: MarketplaceCode; displayName: string },
  ) {
    return this.marketplace.createAccount(user.tenantId, body.marketplace, body.displayName);
  }

  @Post('accounts/:id/sync')
  @RequirePermissions(Permission.AdWrite)
  syncAccount(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.sync.syncAccount(id, user.tenantId);
  }

  @Get('capabilities/:code')
  @RequirePermissions(Permission.AdRead)
  getCapabilities(@Param('code') code: MarketplaceCode) {
    return this.capabilities.getCapabilities(code);
  }

  @Get('recommendations')
  @RequirePermissions(Permission.AnalyticsRead)
  listRecommendations(@CurrentUser() user: CurrentUserDto) {
    return this.recommendations.listPending(user.tenantId);
  }

  @Get('analytics/summary')
  @RequirePermissions(Permission.AnalyticsRead)
  analyticsSummary(@CurrentUser() user: CurrentUserDto) {
    return this.analytics.getTenantSummary(user.tenantId);
  }

  @Get('knowledge/:kind/:entityId')
  @RequirePermissions(Permission.AnalyticsRead)
  knowledgeContext(
    @CurrentUser() user: CurrentUserDto,
    @Param('kind') kind: string,
    @Param('entityId') entityId: string,
  ) {
    return this.knowledgeGraph.getContext(user.tenantId, kind, entityId);
  }

  @Get('observability/health')
  @RequirePermissions(Permission.SettingsWrite)
  observabilityHealth() {
    return this.observability.getHealthSummary();
  }
}
