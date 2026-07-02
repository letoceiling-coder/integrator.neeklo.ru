import { Global, Module } from '@nestjs/common';
import { ProjectionManager } from './projection.manager';

@Global()
@Module({
  providers: [ProjectionManager],
  exports: [ProjectionManager],
})
export class ProjectionsModule {}
