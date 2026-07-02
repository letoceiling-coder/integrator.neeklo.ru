import { Global, Module } from '@nestjs/common';
import { WorkflowEngine } from './workflow.engine';

@Global()
@Module({
  providers: [WorkflowEngine],
  exports: [WorkflowEngine],
})
export class WorkflowModule {}
