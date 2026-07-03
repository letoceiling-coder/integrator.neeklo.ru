import { Module, forwardRef } from '@nestjs/common';
import { AdaptersModule } from '../adapters/adapters.module';
import { AvitoLiveSyncEngineService } from './sync/avito-live-sync-engine.service';
import { AvitoLiveSchedulerService } from './sync/avito-live-scheduler.service';
import { AvitoLiveRequestLogService } from './logging/avito-live-request-log.service';
import { AvitoLivePlatformService } from './avito-live-platform.service';

/** Avito Live Platform — sync engine, scheduler, read models (Phase A3). */
@Module({
  imports: [AdaptersModule],
  providers: [
    AvitoLiveRequestLogService,
    AvitoLiveSyncEngineService,
    AvitoLiveSchedulerService,
    AvitoLivePlatformService,
  ],
  exports: [
    AvitoLiveRequestLogService,
    AvitoLiveSyncEngineService,
    AvitoLiveSchedulerService,
    AvitoLivePlatformService,
  ],
})
export class AvitoLiveModule {}
