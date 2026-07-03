import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AvitoOperationsTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async append(
    tenantId: string,
    entry: {
      adId?: string | null;
      accountId?: string | null;
      kind: string;
      title: string;
      detail?: string | null;
      correlationId?: string | null;
    },
  ): Promise<void> {
    await this.prisma.avitoOperationsTimelineReadModel.create({
      data: {
        tenantId,
        adId: entry.adId ?? null,
        accountId: entry.accountId ?? null,
        kind: entry.kind,
        title: entry.title,
        detail: entry.detail ?? null,
        correlationId: entry.correlationId ?? null,
        occurredAt: new Date(),
      },
    });
  }

  list(tenantId: string, opts: { adId?: string; accountId?: string; limit?: number }) {
    return this.prisma.avitoOperationsTimelineReadModel.findMany({
      where: {
        tenantId,
        ...(opts.adId ? { adId: opts.adId } : {}),
        ...(opts.accountId ? { accountId: opts.accountId } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: opts.limit ?? 100,
    });
  }
}
