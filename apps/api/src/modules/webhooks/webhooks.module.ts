import { Module } from '@nestjs/common';
import { AvitoWebhookController } from './avito-webhook.controller';
import { AvitoLiveModule } from '../../platform/avito-live/avito-live.module';
import { AvitoSalesModule } from '../../platform/avito-sales/avito-sales.module';
import { AvitoProductionModule } from '../../platform/avito-production/avito-production.module';

@Module({
  imports: [AvitoLiveModule, AvitoSalesModule, AvitoProductionModule],
  controllers: [AvitoWebhookController],
})
export class WebhooksModule {}
