import { Injectable } from '@nestjs/common';
import { AvitoLeadCenterService } from './avito-lead-center.service';
import { AvitoPipelineService } from './avito-pipeline.service';
import { AvitoCustomer360Service } from './avito-customer360.service';
import { AvitoSmartInboxService } from './avito-smart-inbox.service';
import { AvitoSalesAgentConfigService } from './avito-sales-agent-config.service';
import { AvitoSmartRepliesService } from './avito-smart-replies.service';
import { AvitoFollowUpEngineService } from './avito-followup-engine.service';
import { AvitoDealAnalyzerService } from './avito-deal-analyzer.service';
import { AvitoDocumentCenterService } from './avito-document-center.service';
import { AvitoSalesDashboardService } from './avito-sales-dashboard.service';
import { AvitoCrmBridgeService } from './avito-crm-bridge.service';
import { CalendarEngine, NotificationEngine, TaskEngine } from '../commerce/commerce-services';
import { SalesAgentService } from '../commerce/sales-agent.service';

@Injectable()
export class AvitoSalesCenterService {
  constructor(
    public readonly leads: AvitoLeadCenterService,
    public readonly pipeline: AvitoPipelineService,
    public readonly customer360: AvitoCustomer360Service,
    public readonly inbox: AvitoSmartInboxService,
    public readonly agentConfig: AvitoSalesAgentConfigService,
    public readonly smartReplies: AvitoSmartRepliesService,
    public readonly followUp: AvitoFollowUpEngineService,
    public readonly dealAnalyzer: AvitoDealAnalyzerService,
    public readonly documents: AvitoDocumentCenterService,
    public readonly dashboard: AvitoSalesDashboardService,
    public readonly bridge: AvitoCrmBridgeService,
    public readonly tasks: TaskEngine,
    public readonly calendar: CalendarEngine,
    public readonly notifications: NotificationEngine,
    public readonly agent: SalesAgentService,
  ) {}
}
