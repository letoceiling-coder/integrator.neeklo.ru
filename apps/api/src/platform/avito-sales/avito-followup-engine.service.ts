import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { TaskEngine, NotificationEngine } from '../commerce/commerce-services';

const DEFAULT_RULES = [
  { name: 'No reply 1 day', trigger: 'no_reply', delayDays: 1 },
  { name: 'No reply 3 days', trigger: 'no_reply', delayDays: 3 },
  { name: 'No reply 7 days', trigger: 'no_reply', delayDays: 7 },
  { name: 'Post-sale 30 days', trigger: 'post_sale', delayDays: 30 },
];

@Injectable()
export class AvitoFollowUpEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvitoFollowUpEngineService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TaskEngine,
    private readonly notifications: NotificationEngine,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick().catch((e) => this.logger.error(e)), 3600_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async seedForLead(tenantId: string, leadId: string, customerId: string) {
    const now = Date.now();
    for (const rule of DEFAULT_RULES) {
      await this.prisma.avitoFollowUpReadModel.create({
        data: {
          tenantId,
          leadId,
          customerId,
          name: rule.name,
          trigger: rule.trigger,
          delayDays: rule.delayDays,
          dueAt: new Date(now + rule.delayDays * 86400_000),
          status: 'pending',
          createdAt: new Date(),
        },
      });
    }
  }

  private async tick(): Promise<void> {
    const due = await this.prisma.avitoFollowUpReadModel.findMany({
      where: { status: 'pending', enabled: true, dueAt: { lte: new Date() } },
      take: 50,
    });

    for (const f of due) {
      await this.tasks.create(f.tenantId, {
        title: `Follow-up: ${f.name}`,
        description: `Trigger: ${f.trigger}`,
        entityType: 'lead',
        entityId: f.leadId ?? undefined,
        createdByAi: true,
        priority: 'normal',
      });
      await this.notifications.notify(f.tenantId, {
        source: 'crm',
        category: 'follow_up',
        title: f.name,
        body: `Follow-up для лида ${f.leadId}`,
        priority: 'normal',
        entityType: 'lead',
        entityId: f.leadId,
      });
      await this.prisma.avitoFollowUpReadModel.update({
        where: { id: f.id },
        data: { status: 'executed', executedAt: new Date() },
      });
    }
  }
}
