import { Module, forwardRef } from '@nestjs/common';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { CommerceModule } from '../commerce/commerce.module';
import { AiWatchersService } from './ai-watchers.service';
import { AutomationRulesService } from './automation-rules.service';
import { AvitoObservatoryService } from './ai-observatory.service';
import { AiOpportunitiesService } from './ai-opportunities.service';
import { PriceIntelligenceService } from './price-intelligence.service';
import { ContentIntelligenceService } from './content-intelligence.service';
import { NotificationPoliciesService } from './notification-policies.service';
import { AiReportsService } from './ai-reports.service';
import { ExecutiveAiService } from './executive-ai.service';
import { AvitoAutomationCenterService } from './avito-automation-center.service';
import { AvitoAutomationSchedulerService } from './avito-automation-scheduler.service';

@Module({
  imports: [
    forwardRef(() => IntelligenceModule),
    forwardRef(() => AiPlatformModule),
    forwardRef(() => CommerceModule),
  ],
  providers: [
    AvitoObservatoryService,
    AiWatchersService,
    AutomationRulesService,
    AiOpportunitiesService,
    PriceIntelligenceService,
    ContentIntelligenceService,
    NotificationPoliciesService,
    AiReportsService,
    ExecutiveAiService,
    AvitoAutomationCenterService,
    AvitoAutomationSchedulerService,
  ],
  exports: [AvitoAutomationCenterService],
})
export class AvitoAutomationModule {}
