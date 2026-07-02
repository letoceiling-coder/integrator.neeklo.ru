import { Module, type OnModuleInit } from '@nestjs/common';
import { ProjectionManager } from '../../platform/projections/projection.manager';
import { AccountRepository } from './domain/account.repository';
import { AccountProjection } from './projections/account.projection';

@Module({
  providers: [AccountRepository, AccountProjection],
  exports: [AccountRepository],
})
export class AccountModule implements OnModuleInit {
  constructor(
    private readonly projections: ProjectionManager,
    private readonly accountProjection: AccountProjection,
  ) {}

  onModuleInit(): void {
    this.projections.register(this.accountProjection);
  }
}
