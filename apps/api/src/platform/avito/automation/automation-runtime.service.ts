import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { EventType, AvitoEventType } from '@neeklo/contracts';
import { WorkflowEngine } from '../../workflow/workflow.engine';
import { PrismaService } from '../../prisma/prisma.service';
import { AvitoEventPublisher } from '../events/avito-event.publisher';
import { NotificationChannelService } from '../notifications/notification-channel.service';

/** Wires saved automations + Avito triggers to Workflow Engine. */
@Injectable()
export class AutomationRuntimeService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutomationRuntimeService.name);

  constructor(
    private readonly workflow: WorkflowEngine,
    private readonly prisma: PrismaService,
    private readonly publisher: AvitoEventPublisher,
    private readonly notifications: NotificationChannelService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.registerBuiltinTriggers();
    await this.loadSavedAutomations();
  }

  private registerBuiltinTriggers(): void {
    const triggers: { id: string; name: string; events: EventType[] }[] = [
      { id: 'avito-new-message', name: 'Avito: new message alert', events: [EventType.MessageReceived] },
      { id: 'avito-ad-created', name: 'Avito: new listing', events: [EventType.AdCreated] },
      { id: 'avito-price-changed', name: 'Avito: price change', events: [EventType.PriceChanged] },
      { id: 'avito-status-changed', name: 'Avito: status change', events: [EventType.AdStatusChanged] },
      { id: 'avito-recommendation', name: 'Avito: AI recommendation', events: [EventType.RecommendationGenerated] },
      { id: 'avito-promotion-end', name: 'Avito: promotion ended', events: [EventType.PromotionActivated] },
    ];

    for (const t of triggers) {
      for (const event of t.events) {
        this.workflow.register({
          id: `${t.id}-${event}`,
          name: t.name,
          triggers: [event],
          run: async (ev) => {
            await this.notifications.dispatch(
              ev.tenantId,
              {
                category: 'automation',
                title: t.name,
                body: `Event ${ev.type} on ${ev.aggregateId}`,
                entityType: ev.aggregateType,
                entityId: ev.aggregateId,
              },
              ['in_app'],
            );
            await this.publisher.publish(ev.tenantId, `auto:${t.id}`, AvitoEventType.AutomationExecuted, {
              automationId: t.id,
              trigger: ev.type,
              success: true,
              executedAt: new Date().toISOString(),
            });
          },
        });
      }
    }

    this.logger.log('Avito automation triggers registered');
  }

  private async loadSavedAutomations(): Promise<void> {
    const automations = await this.prisma.automationReadModel.findMany({ where: { enabled: true }, take: 100 });
    for (const auto of automations) {
      const def = auto.definition as { triggers?: string[]; action?: string };
      const triggers = (def.triggers ?? []) as EventType[];
      if (!triggers.length) continue;

      this.workflow.register({
        id: `saved-${auto.id}`,
        name: auto.name,
        triggers,
        run: async (ev) => {
          await this.publisher.publish(ev.tenantId, `auto:${auto.id}`, AvitoEventType.AutomationExecuted, {
            automationId: auto.id,
            trigger: ev.type,
            success: true,
            executedAt: new Date().toISOString(),
          });
          await this.prisma.automationReadModel.update({
            where: { id: auto.id },
            data: { runCount: { increment: 1 } },
          });
        },
      });
    }
    this.logger.log(`Loaded ${automations.length} saved automations`);
  }
}
