import { Module } from '@nestjs/common';
import { CommerceController } from './commerce.controller';
import { ConversationModule } from '../conversation/conversation.module';
import { CustomerModule } from '../customer/customer.module';
import { DealModule } from '../deal/deal.module';

@Module({
  imports: [ConversationModule, CustomerModule, DealModule],
  controllers: [CommerceController],
})
export class CommerceApiModule {}
