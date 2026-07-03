import { Module } from '@nestjs/common';
import { AvitoController } from './avito.controller';
import { AvitoLiveController } from './avito-live.controller';
import { AvitoOperationsController } from './avito-operations.controller';
import { AvitoSalesController } from './avito-sales.controller';
import { AvitoAutomationController } from './avito-automation.controller';
import { AvitoProductionController } from './avito-production.controller';
import { ConversationModule } from '../conversation/conversation.module';
import { AvitoLiveModule } from '../../platform/avito-live/avito-live.module';
import { AvitoOperationsModule } from '../../platform/avito-operations/avito-operations.module';
import { AvitoSalesModule } from '../../platform/avito-sales/avito-sales.module';
import { AvitoAutomationModule } from '../../platform/avito-automation/avito-automation.module';
import { AvitoProductionModule } from '../../platform/avito-production/avito-production.module';

@Module({
  imports: [ConversationModule, AvitoLiveModule, AvitoOperationsModule, AvitoSalesModule, AvitoAutomationModule, AvitoProductionModule],
  controllers: [AvitoController, AvitoLiveController, AvitoOperationsController, AvitoSalesController, AvitoAutomationController, AvitoProductionController],
})
export class AvitoApiModule {}
