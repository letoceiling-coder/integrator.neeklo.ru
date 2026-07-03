import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { AvitoNotificationPolicyDto, AvitoNotificationPolicyUpsertDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannelService } from '../avito/notifications/notification-channel.service';

@Injectable()
export class NotificationPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: NotificationChannelService,
  ) {}

  async list(tenantId: string): Promise<AvitoNotificationPolicyDto[]> {
    const rows = await this.prisma.avitoNotificationPolicyReadModel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      channels: r.channels as AvitoNotificationPolicyDto['channels'],
      filters: r.filters as AvitoNotificationPolicyDto['filters'],
    }));
  }

  async upsert(tenantId: string, dto: AvitoNotificationPolicyUpsertDto): Promise<AvitoNotificationPolicyDto> {
    const id = dto.id ?? uuid();
    const row = await this.prisma.avitoNotificationPolicyReadModel.upsert({
      where: { id },
      create: {
        id,
        tenantId,
        name: dto.name,
        enabled: dto.enabled ?? true,
        channels: dto.channels,
        filters: dto.filters,
        createdAt: new Date(),
      },
      update: {
        name: dto.name,
        enabled: dto.enabled ?? true,
        channels: dto.channels,
        filters: dto.filters,
      },
    });
    return {
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      channels: row.channels as AvitoNotificationPolicyDto['channels'],
      filters: row.filters as AvitoNotificationPolicyDto['filters'],
    };
  }

  /** Dispatch through enabled policies — respects filter categories. */
  async dispatchFiltered(
    tenantId: string,
    input: { category: string; title: string; body: string; priority?: string; entityType?: string; entityId?: string },
    filterCategory: 'critical' | 'ai' | 'sales' | 'all',
  ) {
    const policies = await this.prisma.avitoNotificationPolicyReadModel.findMany({
      where: { tenantId, enabled: true },
    });

    const matching = policies.filter(
      (p) => p.filters.includes('all') || p.filters.includes(filterCategory),
    );

    const channelSet = new Set<string>();
    for (const p of matching) {
      for (const c of p.channels) channelSet.add(c);
    }

    const channels = channelSet.size
      ? (Array.from(channelSet) as ('telegram' | 'max' | 'email' | 'web_push' | 'in_app')[])
      : (['in_app'] as const);

    return this.channels.dispatch(tenantId, input, [...channels]);
  }
}
