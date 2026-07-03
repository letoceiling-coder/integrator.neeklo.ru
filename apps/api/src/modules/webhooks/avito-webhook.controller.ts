import { Body, Controller, Headers, Post, Query } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { AvitoLivePlatformService } from '../../platform/avito-live/avito-live-platform.service';
import { AvitoCrmBridgeService } from '../../platform/avito-sales/avito-crm-bridge.service';
import { ProductionRealtimeService } from '../../platform/avito-production/production-realtime.service';

/** Inbound Avito webhooks → Live Platform + CRM bridge. */
@Controller('webhooks/avito')
export class AvitoWebhookController {
  constructor(
    private readonly live: AvitoLivePlatformService,
    private readonly crm: AvitoCrmBridgeService,
    private readonly realtime: ProductionRealtimeService,
  ) {}

  @Public()
  @Post()
  async receive(
    @Query('tenantId') tenantId: string,
    @Query('accountId') accountId: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
  ) {
    if (!tenantId || !accountId) {
      return { ok: false, error: 'tenantId and accountId query params required' };
    }

    const payload = body as { payload?: { type?: string; value?: unknown } };
    const eventType = payload?.payload?.type ?? 'unknown';

    await this.live.handleWebhook(tenantId, accountId, eventType, {
      body,
      headers: {
        'x-avito-signature': headers['x-avito-signature'] ?? headers['X-Avito-Signature'] ?? null,
      },
    });

    const crmResult = await this.crm.ingestWebhookMessage(tenantId, accountId, body);

    this.realtime.publish(tenantId, 'webhook', { eventType, accountId, crm: crmResult });

    return { ok: true, eventType, crm: crmResult };
  }
}
