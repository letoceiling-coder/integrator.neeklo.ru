import { Module, type OnModuleInit } from '@nestjs/common';
import { ProjectionManager } from '../../platform/projections/projection.manager';
import { AdsController } from './ads.controller';
import { AdsService } from './application/ads.service';
import { AdsQueryService } from './application/ads-query.service';
import { AdRepository } from './domain/ad.repository';
import { AdProjection } from './projections/ad.projection';

@Module({
  controllers: [AdsController],
  providers: [AdsService, AdsQueryService, AdRepository, AdProjection],
  exports: [AdsService, AdsQueryService],
})
export class AdsModule implements OnModuleInit {
  constructor(
    private readonly projections: ProjectionManager,
    private readonly adProjection: AdProjection,
  ) {}

  onModuleInit(): void {
    this.projections.register(this.adProjection);
  }
}
