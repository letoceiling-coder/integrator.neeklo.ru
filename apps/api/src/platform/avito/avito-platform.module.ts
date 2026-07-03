import { Global, Module, forwardRef } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { AvitoEventPublisher } from './events/avito-event.publisher';
import { ObjectStorageService } from './storage/object-storage.service';
import { AvitoAccountCenterService } from './account/avito-account-center.service';
import { AvitoAdsManagerService } from './ads/avito-ads-manager.service';
import { ListingGeneratorPipeline } from './listing/listing-generator.pipeline';
import { RegionalPublishingService } from './regional/regional-publishing.service';
import { AvitoAnalyticsCenterService } from './analytics/avito-analytics-center.service';
import { KnowledgeBaseService } from './knowledge/knowledge-base.service';
import { MediaPipelineService } from './media/media-pipeline.service';
import { NotificationChannelService } from './notifications/notification-channel.service';
import { AutomationRuntimeService } from './automation/automation-runtime.service';
import { AvitoBudgetService } from './budget/avito-budget.service';
import { AvitoLiveModule } from '../avito-live/avito-live.module';
import { AvitoSyncOrchestratorService } from './sync/avito-sync-orchestrator.service';
import { AdsModule } from '../../modules/ads/ads.module';

@Global()
@Module({
  imports: [forwardRef(() => CommerceModule), forwardRef(() => AiPlatformModule), AdsModule, forwardRef(() => AvitoLiveModule)],
  providers: [
    AvitoEventPublisher,
    ObjectStorageService,
    AvitoAccountCenterService,
    AvitoAdsManagerService,
    ListingGeneratorPipeline,
    RegionalPublishingService,
    AvitoAnalyticsCenterService,
    KnowledgeBaseService,
    MediaPipelineService,
    NotificationChannelService,
    AutomationRuntimeService,
    AvitoBudgetService,
    AvitoSyncOrchestratorService,
  ],
  exports: [
    AvitoEventPublisher,
    ObjectStorageService,
    AvitoAccountCenterService,
    AvitoAdsManagerService,
    ListingGeneratorPipeline,
    RegionalPublishingService,
    AvitoAnalyticsCenterService,
    KnowledgeBaseService,
    MediaPipelineService,
    NotificationChannelService,
    AvitoBudgetService,
    AvitoSyncOrchestratorService,
  ],
})
export class AvitoPlatformModule {}
