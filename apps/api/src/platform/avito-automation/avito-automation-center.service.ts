import { Injectable } from '@nestjs/common';
import { AiWatchersService } from './ai-watchers.service';
import { AutomationRulesService } from './automation-rules.service';
import { AvitoObservatoryService } from './ai-observatory.service';
import { AiOpportunitiesService } from './ai-opportunities.service';
import { PriceIntelligenceService } from './price-intelligence.service';
import { ContentIntelligenceService } from './content-intelligence.service';
import { NotificationPoliciesService } from './notification-policies.service';
import { AiReportsService } from './ai-reports.service';
import { ExecutiveAiService } from './executive-ai.service';

@Injectable()
export class AvitoAutomationCenterService {
  constructor(
    public readonly watchers: AiWatchersService,
    public readonly rules: AutomationRulesService,
    public readonly observatory: AvitoObservatoryService,
    public readonly opportunities: AiOpportunitiesService,
    public readonly price: PriceIntelligenceService,
    public readonly content: ContentIntelligenceService,
    public readonly notificationPolicies: NotificationPoliciesService,
    public readonly reports: AiReportsService,
    public readonly executive: ExecutiveAiService,
  ) {}
}
