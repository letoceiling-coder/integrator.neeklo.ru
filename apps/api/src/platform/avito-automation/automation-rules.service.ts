import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { AvitoAutomationRuleDto, AvitoAutomationRuleUpsertDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannelService } from '../avito/notifications/notification-channel.service';
import { TaskEngine } from '../commerce/commerce-services';
import { AvitoObservatoryService } from './ai-observatory.service';
import { AiWatchersService } from './ai-watchers.service';

@Injectable()
export class AutomationRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly observatory: AvitoObservatoryService,
    private readonly notifications: NotificationChannelService,
    private readonly tasks: TaskEngine,
    private readonly watchers: AiWatchersService,
  ) {}

  async list(tenantId: string): Promise<AvitoAutomationRuleDto[]> {
    const rows = await this.prisma.avitoAutomationRuleReadModel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async upsert(tenantId: string, dto: AvitoAutomationRuleUpsertDto): Promise<AvitoAutomationRuleDto> {
    const id = dto.id ?? uuid();
    const row = await this.prisma.avitoAutomationRuleReadModel.upsert({
      where: { id },
      create: {
        id,
        tenantId,
        name: dto.name,
        enabled: dto.enabled ?? true,
        metric: dto.metric,
        operator: dto.operator,
        threshold: dto.threshold,
        actionType: dto.actionType,
        actionPayload: (dto.actionPayload ?? {}) as object,
        requiresConfirmation: dto.requiresConfirmation ?? true,
        createdAt: new Date(),
      },
      update: {
        name: dto.name,
        enabled: dto.enabled ?? true,
        metric: dto.metric,
        operator: dto.operator,
        threshold: dto.threshold,
        actionType: dto.actionType,
        actionPayload: (dto.actionPayload ?? {}) as object,
        requiresConfirmation: dto.requiresConfirmation ?? true,
      },
    });
    return this.toDto(row);
  }

  async evaluateAll(tenantId: string): Promise<{ triggered: number }> {
    await this.watchers.evaluateAll(tenantId);
    const rules = await this.prisma.avitoAutomationRuleReadModel.findMany({ where: { tenantId, enabled: true } });
    let triggered = 0;

    for (const rule of rules) {
      const hit = await this.checkRule(tenantId, rule);
      if (!hit) continue;
      triggered++;
      const title = rule.name;
      const body = (rule.actionPayload as { message?: string }).message ?? `Правило «${rule.name}» сработало`;

      await this.observatory.upsertItem(tenantId, {
        kind: 'recommendation',
        severity: 'info',
        title,
        body,
        entityType: null,
        entityId: null,
        source: 'automation_rule',
        dedupeKey: `rule:${rule.id}:${new Date().toISOString().slice(0, 10)}`,
      });

      if (rule.actionType === 'notify') {
        await this.notifications.dispatch(tenantId, { category: 'automation', title, body }, ['in_app']);
      }
      if (rule.actionType === 'task') {
        await this.tasks.create(tenantId, {
          title: body,
          priority: 'normal',
          createdByAi: true,
        });
      }

      await this.prisma.avitoAutomationRuleReadModel.update({
        where: { id: rule.id },
        data: { lastTriggeredAt: new Date(), triggerCount: { increment: 1 } },
      });
    }

    return { triggered };
  }

  private async checkRule(
    tenantId: string,
    rule: { metric: string; operator: string; threshold: number },
  ): Promise<boolean> {
    if (rule.operator === 'no_messages_days') {
      const cutoff = new Date(Date.now() - rule.threshold * 86400_000);
      const convs = await this.prisma.conversationReadModel.findMany({ where: { tenantId }, take: 50 });
      for (const c of convs) {
        const last = await this.prisma.messageReadModel.findFirst({
          where: { tenantId, conversationId: c.id },
          orderBy: { sentAt: 'desc' },
        });
        if (!last || last.sentAt < cutoff) return true;
      }
      return false;
    }

    if (rule.operator === 'budget_days_left') {
      const org = await this.prisma.organizationReadModel.findUnique({ where: { tenantId } });
      const ads = await this.prisma.adReadModel.findMany({ where: { tenantId } });
      const spend = ads.reduce((s, a) => s + a.spendAmount, 0);
      const daily = spend / 30 || 1;
      const remaining = (org?.budgetTotal ?? 0) - spend;
      const daysLeft = remaining / daily;
      return daysLeft <= rule.threshold;
    }

    const ads = await this.prisma.adReadModel.findMany({ where: { tenantId, status: 'active' } });
    if (!ads.length) return false;

    const avgCtr = ads.reduce((s, a) => s + a.ctr, 0) / ads.length;
    const prevCtr = avgCtr * 1.3;

    if (rule.metric === 'ctr' && rule.operator === 'drop_pct') {
      const dropPct = prevCtr > 0 ? ((prevCtr - avgCtr) / prevCtr) * 100 : 0;
      return dropPct >= rule.threshold;
    }

    if (rule.operator === 'ai_confidence') {
      const decisions = await this.prisma.decisionReadModel.findMany({
        where: { tenantId, status: 'pending' },
        orderBy: { confidence: 'desc' },
        take: 1,
      });
      return (decisions[0]?.confidence ?? 0) >= rule.threshold / 100;
    }

    return false;
  }

  private toDto(r: {
    id: string;
    name: string;
    enabled: boolean;
    metric: string;
    operator: string;
    threshold: number;
    actionType: string;
    actionPayload: unknown;
    requiresConfirmation: boolean;
    lastTriggeredAt: Date | null;
    triggerCount: number;
  }): AvitoAutomationRuleDto {
    return {
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      metric: r.metric as AvitoAutomationRuleDto['metric'],
      operator: r.operator as AvitoAutomationRuleDto['operator'],
      threshold: r.threshold,
      actionType: r.actionType as AvitoAutomationRuleDto['actionType'],
      actionPayload: r.actionPayload as Record<string, unknown>,
      requiresConfirmation: r.requiresConfirmation,
      lastTriggeredAt: r.lastTriggeredAt?.toISOString() ?? null,
      triggerCount: r.triggerCount,
    };
  }
}
