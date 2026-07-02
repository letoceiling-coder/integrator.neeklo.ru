import { Global, Module, forwardRef } from '@nestjs/common';
import { DealModule } from '../../modules/deal/deal.module';
import { ConversationModule } from '../../modules/conversation/conversation.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { AvitoPlatformModule } from '../avito/avito-platform.module';
import { JobEngine } from './job/job.engine';
import {
  NotificationEngine,
  TaskEngine,
  CalendarEngine,
  SearchEngine,
  TimelineEngine,
  ListingStudioService,
  BudgetCenterService,
  AutomationStudioService,
} from './commerce-services';
import { SalesAgentService } from './sales-agent.service';
import { CommerceBootstrapService } from './commerce-bootstrap.service';

@Global()
@Module({
  imports: [DealModule, ConversationModule, forwardRef(() => AiPlatformModule), forwardRef(() => AvitoPlatformModule)],
  providers: [
    JobEngine,
    NotificationEngine,
    TaskEngine,
    CalendarEngine,
    SearchEngine,
    TimelineEngine,
    ListingStudioService,
    BudgetCenterService,
    AutomationStudioService,
    SalesAgentService,
    CommerceBootstrapService,
  ],
  exports: [
    JobEngine,
    NotificationEngine,
    TaskEngine,
    CalendarEngine,
    SearchEngine,
    TimelineEngine,
    ListingStudioService,
    BudgetCenterService,
    AutomationStudioService,
    SalesAgentService,
  ],
})
export class CommerceModule {}
