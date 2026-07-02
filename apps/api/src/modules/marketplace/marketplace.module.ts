import { Module, type OnModuleInit } from '@nestjs/common';
import { ProjectionManager } from '../../platform/projections/projection.manager';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceRepository } from './domain/marketplace.repository';
import { MarketplaceProjection } from './projections/marketplace.projection';

@Module({
  controllers: [MarketplaceController],
  providers: [MarketplaceRepository, MarketplaceProjection],
  exports: [MarketplaceRepository],
})
export class MarketplaceModule implements OnModuleInit {
  constructor(
    private readonly projections: ProjectionManager,
    private readonly marketplaceProjection: MarketplaceProjection,
  ) {}

  onModuleInit(): void {
    this.projections.register(this.marketplaceProjection);
  }
}
