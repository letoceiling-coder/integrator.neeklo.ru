import { Module, forwardRef } from '@nestjs/common';
import { ConversationModule } from '../../modules/conversation/conversation.module';
import { CustomerModule } from '../../modules/customer/customer.module';
import { DealModule } from '../../modules/deal/deal.module';
import { CommerceModule } from '../commerce/commerce.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { AvitoCrmBridgeService } from './avito-crm-bridge.service';
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
import { AvitoSalesCenterService } from './avito-sales-center.service';
import { AvitoSalesSyncSchedulerService } from './avito-sales-sync-scheduler.service';

@Module({
  imports: [
    ConversationModule,
    CustomerModule,
    DealModule,
    forwardRef(() => CommerceModule),
    forwardRef(() => IntelligenceModule),
  ],
  providers: [
    AvitoCrmBridgeService,
    AvitoLeadCenterService,
    AvitoPipelineService,
    AvitoCustomer360Service,
    AvitoSmartInboxService,
    AvitoSalesAgentConfigService,
    AvitoSmartRepliesService,
    AvitoFollowUpEngineService,
    AvitoDealAnalyzerService,
    AvitoDocumentCenterService,
    AvitoSalesDashboardService,
    AvitoSalesCenterService,
    AvitoSalesSyncSchedulerService,
  ],
  exports: [AvitoSalesCenterService, AvitoCrmBridgeService],
})
export class AvitoSalesModule {}
