import { Module, forwardRef } from '@nestjs/common';
import { AdsModule } from '../../modules/ads/ads.module';
import { CommerceModule } from '../commerce/commerce.module';
import { AvitoOperationsCenterService } from './avito-operations-center.service';
import { AvitoOperationsAdsService } from './avito-operations-ads.service';
import { AvitoOperationsStudioService } from './avito-operations-studio.service';
import { AvitoOperationsBulkService } from './avito-operations-bulk.service';
import { AvitoOperationsFeedService } from './avito-operations-feed.service';
import { AvitoOperationsPromotionService } from './avito-operations-promotion.service';
import { AvitoOperationsTimelineService } from './avito-operations-timeline.service';
import { AdaptersModule } from '../adapters/adapters.module';

@Module({
  imports: [AdsModule, AdaptersModule, forwardRef(() => CommerceModule)],
  providers: [
    AvitoOperationsTimelineService,
    AvitoOperationsAdsService,
    AvitoOperationsStudioService,
    AvitoOperationsBulkService,
    AvitoOperationsFeedService,
    AvitoOperationsPromotionService,
    AvitoOperationsCenterService,
  ],
  exports: [
    AvitoOperationsCenterService,
    AvitoOperationsStudioService,
    AvitoOperationsBulkService,
    AvitoOperationsFeedService,
    AvitoOperationsTimelineService,
  ],
})
export class AvitoOperationsModule {}
