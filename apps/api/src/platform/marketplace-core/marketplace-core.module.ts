import { Global, Module } from '@nestjs/common';
import { SNAPSHOT_STORE } from '@neeklo/kernel';
import { AccountModule } from '../../modules/account/account.module';
import { MarketplaceModule } from '../../modules/marketplace/marketplace.module';
import { SnapshotStoreService, SnapshotEngine } from './snapshot/snapshot.engine';
import { SyncEngine } from './sync/sync.engine';
import { MetricsEngine } from './metrics/metrics.engine';
import { AnalyticsEngine } from './analytics/analytics.engine';
import { RecommendationEngine } from './recommendation/recommendation.engine';
import { KnowledgeGraphService } from './knowledge-graph/knowledge-graph.service';
import { MarketplacePolicyEngine } from './policies/marketplace-policy.engine';
import { ObservabilityService } from './observability/observability.service';
import { MarketplaceRegistryService } from './registry/marketplace-registry.service';
import {
  MarketplaceService,
  MarketplaceAuthorizationService,
  MarketplaceSyncService,
  MarketplaceHealthService,
  MarketplaceCapabilityService,
  MarketplaceStatisticsService,
  MarketplaceRecommendationService,
  MarketplaceForecastService,
  MarketplaceBudgetService,
  MarketplacePublicationService,
  MarketplaceModerationService,
} from './services/marketplace.services';

@Global()
@Module({
  imports: [MarketplaceModule, AccountModule],
  providers: [
    SnapshotStoreService,
    SnapshotEngine,
    { provide: SNAPSHOT_STORE, useExisting: SnapshotStoreService },
    SyncEngine,
    MetricsEngine,
    AnalyticsEngine,
    RecommendationEngine,
    KnowledgeGraphService,
    MarketplacePolicyEngine,
    ObservabilityService,
    MarketplaceRegistryService,
    MarketplaceService,
    MarketplaceAuthorizationService,
    MarketplaceSyncService,
    MarketplaceHealthService,
    MarketplaceCapabilityService,
    MarketplaceStatisticsService,
    MarketplaceRecommendationService,
    MarketplaceForecastService,
    MarketplaceBudgetService,
    MarketplacePublicationService,
    MarketplaceModerationService,
  ],
  exports: [
    SnapshotStoreService,
    SnapshotEngine,
    SNAPSHOT_STORE,
    SyncEngine,
    MetricsEngine,
    AnalyticsEngine,
    RecommendationEngine,
    KnowledgeGraphService,
    MarketplacePolicyEngine,
    ObservabilityService,
    MarketplaceRegistryService,
    MarketplaceService,
    MarketplaceAuthorizationService,
    MarketplaceSyncService,
    MarketplaceHealthService,
    MarketplaceCapabilityService,
    MarketplaceStatisticsService,
    MarketplaceRecommendationService,
    MarketplaceForecastService,
    MarketplaceBudgetService,
    MarketplacePublicationService,
    MarketplaceModerationService,
  ],
})
export class MarketplaceCoreModule {}
