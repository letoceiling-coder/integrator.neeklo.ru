import { Module, type OnModuleInit } from '@nestjs/common';
import { DealService, DealQueryService } from './application/deal.service';
import { DealRepository } from './domain/deal.repository';
import { DealProjection } from './projections/deal.projection';
import { ProjectionManager } from '../../platform/projections/projection.manager';

@Module({
  providers: [DealService, DealQueryService, DealRepository, DealProjection],
  exports: [DealService, DealQueryService],
})
export class DealModule implements OnModuleInit {
  constructor(
    private readonly projections: ProjectionManager,
    private readonly projection: DealProjection,
  ) {}

  onModuleInit(): void {
    this.projections.register(this.projection);
  }
}
