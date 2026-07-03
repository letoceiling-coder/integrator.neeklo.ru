import { Module, forwardRef } from '@nestjs/common';
import { OAuthCenterModule } from '../oauth-center/oauth-center.module';
import { AdaptersModule } from '../adapters/adapters.module';
import { AvitoLiveModule } from '../avito-live/avito-live.module';
import { AvitoOperationsModule } from '../avito-operations/avito-operations.module';
import { ProductionReadinessService } from './production-readiness.service';
import { ProductionMonitorService } from './production-monitor.service';
import { ProductionSandboxService } from './production-sandbox.service';
import { ProductionPermissionsService } from './production-permissions.service';
import { ProductionWizardService } from './production-wizard.service';
import { ProductionBackupService } from './production-backup.service';
import { ProductionFeedService } from './production-feed.service';
import { ProductionLiveTestService } from './production-live-test.service';
import { ProductionRealtimeService } from './production-realtime.service';
import { AvitoMessengerOutboundService } from './avito-messenger-outbound.service';
import { AvitoProductionCenterService } from './avito-production-center.service';

@Module({
  imports: [
    forwardRef(() => OAuthCenterModule),
    AdaptersModule,
    AvitoLiveModule,
    AvitoOperationsModule,
  ],
  providers: [
    ProductionSandboxService,
    ProductionPermissionsService,
    AvitoMessengerOutboundService,
    ProductionReadinessService,
    ProductionMonitorService,
    ProductionWizardService,
    ProductionBackupService,
    ProductionFeedService,
    ProductionLiveTestService,
    ProductionRealtimeService,
    AvitoProductionCenterService,
  ],
  exports: [AvitoProductionCenterService, AvitoMessengerOutboundService, ProductionRealtimeService],
})
export class AvitoProductionModule {}
