import { Module } from '@nestjs/common';
import { CommerceController } from './commerce.controller';
import { ConversationModule } from '../conversation/conversation.module';
import { CustomerModule } from '../customer/customer.module';
import { DealModule } from '../deal/deal.module';
import { AvitoProductionModule } from '../../platform/avito-production/avito-production.module';

@Module({
  imports: [ConversationModule, CustomerModule, DealModule, AvitoProductionModule],
  controllers: [CommerceController],
})
export class CommerceApiModule {}
