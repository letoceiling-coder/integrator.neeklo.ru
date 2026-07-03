import { Injectable } from '@nestjs/common';
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

@Injectable()
export class AvitoProductionCenterService {
  constructor(
    public readonly readiness: ProductionReadinessService,
    public readonly monitor: ProductionMonitorService,
    public readonly sandbox: ProductionSandboxService,
    public readonly permissions: ProductionPermissionsService,
    public readonly wizard: ProductionWizardService,
    public readonly backup: ProductionBackupService,
    public readonly feed: ProductionFeedService,
    public readonly liveTest: ProductionLiveTestService,
    public readonly realtime: ProductionRealtimeService,
    public readonly messenger: AvitoMessengerOutboundService,
  ) {}
}
