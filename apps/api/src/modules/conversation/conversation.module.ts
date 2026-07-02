import { Module, type OnModuleInit } from '@nestjs/common';
import { ProjectionManager } from '../../platform/projections/projection.manager';
import { ConversationService, ConversationQueryService } from './application/conversation.service';
import { ConversationRepository } from './domain/conversation.repository';
import { ConversationProjection } from './projections/conversation.projection';

@Module({
  providers: [ConversationService, ConversationQueryService, ConversationRepository, ConversationProjection],
  exports: [ConversationService, ConversationQueryService],
})
export class ConversationModule implements OnModuleInit {
  constructor(
    private readonly projections: ProjectionManager,
    private readonly projection: ConversationProjection,
  ) {}

  onModuleInit(): void {
    this.projections.register(this.projection);
  }
}
