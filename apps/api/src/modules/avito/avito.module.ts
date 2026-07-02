import { Module } from '@nestjs/common';
import { AvitoController } from './avito.controller';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [ConversationModule],
  controllers: [AvitoController],
})
export class AvitoApiModule {}
