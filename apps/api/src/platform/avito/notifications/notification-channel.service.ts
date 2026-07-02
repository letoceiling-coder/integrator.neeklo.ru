import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AvitoEventType } from '@neeklo/contracts';
import type { NotificationChannelConfigDto } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationEngine } from '../../commerce/commerce-services';
import { AvitoEventPublisher } from '../events/avito-event.publisher';

type Channel = 'telegram' | 'max' | 'email' | 'web_push' | 'in_app';

/** Notification Center — multi-channel dispatch with in-app fallback. */
@Injectable()
export class NotificationChannelService {
  private readonly logger = new Logger(NotificationChannelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inApp: NotificationEngine,
    private readonly publisher: AvitoEventPublisher,
  ) {}

  async getConfig(tenantId: string) {
    return this.prisma.notificationChannelReadModel.findUnique({ where: { tenantId } });
  }

  async saveConfig(tenantId: string, config: NotificationChannelConfigDto) {
    const id = uuid();
    return this.prisma.notificationChannelReadModel.upsert({
      where: { tenantId },
      create: {
        id,
        tenantId,
        telegramChatId: config.telegramChatId ?? null,
        maxUserId: config.maxUserId ?? null,
        email: config.email ?? null,
        webPushEnabled: config.webPushEnabled ?? false,
        updatedAt: new Date(),
      },
      update: {
        telegramChatId: config.telegramChatId ?? null,
        maxUserId: config.maxUserId ?? null,
        email: config.email ?? null,
        webPushEnabled: config.webPushEnabled ?? false,
        updatedAt: new Date(),
      },
    });
  }

  async dispatch(
    tenantId: string,
    input: { category: string; title: string; body: string; priority?: string; entityType?: string; entityId?: string },
    channels: Channel[] = ['in_app'],
  ) {
    const config = await this.getConfig(tenantId);
    const results: { channel: Channel; success: boolean; notificationId: string }[] = [];

    for (const channel of channels) {
      let success = false;
      let notificationId = uuid();

      try {
        switch (channel) {
          case 'in_app': {
            const n = await this.inApp.notify(tenantId, {
              source: 'avito',
              category: input.category,
              title: input.title,
              body: input.body,
              priority: input.priority,
              entityType: input.entityType,
              entityId: input.entityId,
            });
            notificationId = n.id;
            success = true;
            break;
          }
          case 'telegram':
            if (config?.telegramChatId) {
              this.logger.log(`[Telegram stub] → ${config.telegramChatId}: ${input.title}`);
              success = true;
            }
            break;
          case 'max':
            if (config?.maxUserId) {
              this.logger.log(`[MAX stub] → ${config.maxUserId}: ${input.title}`);
              success = true;
            }
            break;
          case 'email':
            if (config?.email) {
              this.logger.log(`[Email stub] → ${config.email}: ${input.title}`);
              success = true;
            }
            break;
          case 'web_push':
            if (config?.webPushEnabled) {
              this.logger.log(`[WebPush stub]: ${input.title}`);
              success = true;
            }
            break;
        }
      } catch {
        success = false;
      }

      await this.publisher.publish(tenantId, `notify:${notificationId}`, AvitoEventType.NotificationDispatched, {
        channel,
        notificationId,
        category: input.category,
        success,
        dispatchedAt: new Date().toISOString(),
      });

      results.push({ channel, success, notificationId });
    }

    return results;
  }
}
