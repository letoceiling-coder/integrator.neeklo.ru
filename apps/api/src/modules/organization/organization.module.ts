import { Module } from '@nestjs/common';
import { OrganizationRepository } from './domain/organization.repository';

@Module({
  providers: [OrganizationRepository],
  exports: [OrganizationRepository],
})
export class OrganizationModule {}
