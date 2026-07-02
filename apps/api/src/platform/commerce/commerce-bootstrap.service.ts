import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { EventType } from '@neeklo/contracts';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { NotificationEngine } from './commerce-services';
import { DealService } from '../../modules/deal/application/deal.service';
import { PrismaService } from '../prisma/prisma.service';
import { SalesAgentService } from './sales-agent.service';

/** Registers commerce workflows and auto-task rules on bootstrap. */
@Injectable()
export class CommerceBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CommerceBootstrapService.name);

  constructor(
    private readonly workflow: WorkflowEngine,
    private readonly notifications: NotificationEngine,
    private readonly deals: DealService,
    private readonly prisma: PrismaService,
    private readonly salesAgent: SalesAgentService,
  ) {}

  onApplicationBootstrap(): void {
    this.workflow.register({
      id: 'auto-reply-task',
      name: 'AI draft + notify on inbound message',
      triggers: [EventType.MessageReceived],
      run: async (event) => {
        const p = event.payload as { text: string; customerId: string; adId?: string | null };
        await this.notifications.notify(event.tenantId, {
          source: 'marketplace',
          category: 'inbox',
          title: 'Новое сообщение',
          body: p.text.slice(0, 120),
          priority: 'high',
          entityType: 'conversation',
          entityId: event.aggregateId,
        });
        await this.salesAgent.reply({
          tenantId: event.tenantId,
          conversationId: event.aggregateId,
          customerId: p.customerId,
          adId: p.adId ?? null,
          message: p.text,
          autoSend: false,
        });
      },
    });

    this.workflow.register({
      id: 'deal-ai-stage',
      name: 'Suggest deal stage from intelligence',
      triggers: [EventType.ContactRecorded],
      run: async (event) => {
        const deals = await this.prisma.dealReadModel.findMany({
          where: {
            tenantId: event.tenantId,
            adId: event.aggregateId,
            stage: { notIn: ['completed', 'cancelled'] },
          },
          take: 1,
        });
        const deal = deals[0];
        if (deal) {
          await this.deals.suggestStageFromIntelligence(deal.id, event.tenantId, event.aggregateId);
        }
      },
    });

    this.logger.log('Commerce workflows registered');
  }
}
