import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationEngine {
  constructor(private readonly prisma: PrismaService) {}

  async notify(
    tenantId: string,
    input: {
      source: string;
      category: string;
      title: string;
      body: string;
      priority?: string;
      entityType?: string | null;
      entityId?: string | null;
    },
  ): Promise<{ id: string }> {
    const id = uuid();
    await this.prisma.notificationReadModel.create({
      data: {
        id,
        tenantId,
        source: input.source,
        category: input.category,
        title: input.title,
        body: input.body,
        priority: input.priority ?? 'normal',
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        createdAt: new Date(),
      },
    });
    return { id };
  }

  list(tenantId: string, unreadOnly = false) {
    return this.prisma.notificationReadModel.findMany({
      where: { tenantId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(id: string, tenantId: string): Promise<void> {
    await this.prisma.notificationReadModel.updateMany({
      where: { id, tenantId },
      data: { read: true, readAt: new Date() },
    });
  }
}

@Injectable()
export class TaskEngine {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    input: {
      title: string;
      description?: string;
      priority?: string;
      entityType?: string | null;
      entityId?: string | null;
      dueAt?: Date | null;
      createdByAi?: boolean;
      assigneeId?: string | null;
    },
  ): Promise<{ id: string }> {
    const id = uuid();
    await this.prisma.taskReadModel.create({
      data: {
        id,
        tenantId,
        title: input.title,
        description: input.description ?? '',
        priority: input.priority ?? 'normal',
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        dueAt: input.dueAt ?? null,
        createdByAi: input.createdByAi ?? false,
        assigneeId: input.assigneeId ?? null,
        createdAt: new Date(),
      },
    });
    return { id };
  }

  list(tenantId: string, status = 'open') {
    return this.prisma.taskReadModel.findMany({
      where: { tenantId, status },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
      take: 100,
    });
  }

  async complete(id: string, tenantId: string): Promise<void> {
    await this.prisma.taskReadModel.updateMany({
      where: { id, tenantId },
      data: { status: 'completed', completedAt: new Date() },
    });
  }
}

@Injectable()
export class CalendarEngine {
  constructor(private readonly prisma: PrismaService) {}

  async schedule(
    tenantId: string,
    input: {
      kind: string;
      title: string;
      startsAt: Date;
      endsAt?: Date | null;
      entityType?: string | null;
      entityId?: string | null;
    },
  ): Promise<{ id: string }> {
    const id = uuid();
    await this.prisma.calendarEventReadModel.create({
      data: {
        id,
        tenantId,
        kind: input.kind,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        createdAt: new Date(),
      },
    });
    return { id };
  }

  list(tenantId: string, from: Date, to: Date) {
    return this.prisma.calendarEventReadModel.findMany({
      where: { tenantId, startsAt: { gte: from, lte: to } },
      orderBy: { startsAt: 'asc' },
    });
  }
}

@Injectable()
export class SearchEngine {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, q: string, types?: string[], limit = 20) {
    const entries = await this.prisma.searchIndexEntry.findMany({
      where: {
        tenantId,
        ...(types?.length ? { entityType: { in: types } } : {}),
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { body: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });

    if (entries.length > 0) return entries;

    const [ads, customers, conversations] = await Promise.all([
      this.prisma.adReadModel.findMany({
        where: { tenantId, title: { contains: q, mode: 'insensitive' } },
        take: 5,
      }),
      this.prisma.customerReadModel.findMany({
        where: { tenantId, displayName: { contains: q, mode: 'insensitive' } },
        take: 5,
      }),
      this.prisma.conversationReadModel.findMany({
        where: { tenantId, lastMessagePreview: { contains: q, mode: 'insensitive' } },
        take: 5,
      }),
    ]);

    return [
      ...ads.map((a) => ({ entityType: 'ad', entityId: a.id, title: a.title, body: a.status })),
      ...customers.map((c) => ({ entityType: 'customer', entityId: c.id, title: c.displayName, body: c.channel })),
      ...conversations.map((c) => ({ entityType: 'conversation', entityId: c.id, title: c.customerName, body: c.lastMessagePreview })),
    ];
  }

  async index(tenantId: string, entityType: string, entityId: string, title: string, body = ''): Promise<void> {
    await this.prisma.searchIndexEntry.upsert({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
      create: { tenantId, entityType, entityId, title, body, updatedAt: new Date() },
      update: { title, body, updatedAt: new Date() },
    });
  }
}

@Injectable()
export class TimelineEngine {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(tenantId: string, entityType?: string, entityId?: string, limit = 50) {
    const events = await this.prisma.eventStore.findMany({
      where: {
        tenantId,
        ...(entityType && entityId
          ? { aggregateType: entityType, aggregateId: entityId }
          : {}),
      },
      orderBy: { globalPosition: 'desc' },
      take: limit,
    });

    return events.map((e) => ({
      id: e.eventId,
      type: e.type,
      aggregateType: e.aggregateType,
      aggregateId: e.aggregateId,
      occurredAt: e.occurredAt.toISOString(),
      payload: e.payload,
    }));
  }
}

@Injectable()
export class ListingStudioService {
  constructor(private readonly prisma: PrismaService) {}

  async getStudio(adId: string, tenantId: string) {
    const ad = await this.prisma.adReadModel.findFirst({ where: { id: adId, tenantId } });
    if (!ad) return null;

    const [history, conversations, experiments] = await Promise.all([
      this.prisma.listingHistoryEntry.findMany({ where: { tenantId, adId }, orderBy: { recordedAt: 'desc' }, take: 20 }),
      this.prisma.conversationReadModel.findMany({ where: { tenantId, adId }, take: 10 }),
      this.prisma.experimentReadModel.findMany({ where: { tenantId, targetEntityId: adId }, take: 5 }),
    ]);

    return { ad, history, conversations, experiments };
  }

  async recordHistory(tenantId: string, adId: string, changeType: string, snapshot: Record<string, unknown>): Promise<void> {
    await this.prisma.listingHistoryEntry.create({
      data: { tenantId, adId, changeType, snapshot, recordedAt: new Date() },
    });
  }
}

@Injectable()
export class BudgetCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string) {
    const ads = await this.prisma.adReadModel.findMany({ where: { tenantId } });
    const org = await this.prisma.organizationReadModel.findUnique({ where: { tenantId } });
    const totalSpend = ads.reduce((s, a) => s + a.spendAmount, 0);
    const totalRevenue = ads.reduce((s, a) => s + a.revenueAmount, 0);
    const byRegion = new Map<string, { spend: number; revenue: number; count: number }>();

    for (const ad of ads) {
      const r = byRegion.get(ad.regionId) ?? { spend: 0, revenue: 0, count: 0 };
      r.spend += ad.spendAmount;
      r.revenue += ad.revenueAmount;
      r.count += 1;
      byRegion.set(ad.regionId, r);
    }

    return {
      budgetTotal: org?.budgetTotal ?? 0,
      totalSpend,
      totalRevenue,
      roi: totalSpend > 0 ? (totalRevenue - totalSpend) / totalSpend : 0,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      byRegion: [...byRegion.entries()].map(([regionId, v]) => ({
        regionId,
        ...v,
        roi: v.spend > 0 ? (v.revenue - v.spend) / v.spend : 0,
      })),
      byAd: ads.slice(0, 20).map((a) => ({
        adId: a.id,
        title: a.title,
        spend: a.spendAmount,
        revenue: a.revenueAmount,
        roi: a.roi,
      })),
    };
  }
}

@Injectable()
export class AutomationStudioService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, name: string, definition: Record<string, unknown>, enabled = true) {
    const id = uuid();
    await this.prisma.automationReadModel.create({
      data: { id, tenantId, name, definition, enabled, createdAt: new Date(), updatedAt: new Date() },
    });
    return { id };
  }

  list(tenantId: string) {
    return this.prisma.automationReadModel.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
  }
}
