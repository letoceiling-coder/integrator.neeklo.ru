import { Module, type OnModuleInit } from '@nestjs/common';
import { CustomerService, CustomerQueryService } from './application/customer.service';
import { CustomerRepository } from './domain/customer.repository';
import { CustomerProjection } from './projections/customer.projection';
import { ProjectionManager } from '../../platform/projections/projection.manager';

@Module({
  providers: [CustomerService, CustomerQueryService, CustomerRepository, CustomerProjection],
  exports: [CustomerService, CustomerQueryService],
})
export class CustomerModule implements OnModuleInit {
  constructor(
    private readonly projections: ProjectionManager,
    private readonly projection: CustomerProjection,
  ) {}

  onModuleInit(): void {
    this.projections.register(this.projection);
  }
}
