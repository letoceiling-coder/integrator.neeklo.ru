import { Injectable } from '@nestjs/common';
import type { AvitoObservatoryDto, AvitoObservatoryItemDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvitoObservatoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(tenantId: string, includeDismissed = false): Promise<AvitoObservatoryDto> {
    const [stored, decisions, opportunities] = await Promise.all([
      this.prisma.avitoObservatoryItemReadModel.findMany({
        where: { tenantId, ...(includeDismissed ? {} : { dismissed: false }) },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.decisionReadModel.findMany({
        where: { tenantId, status: 'pending' },
        orderBy: { generatedAt: 'desc' },
        take: 30,
      }),
      this.prisma.opportunityReadModel.findMany({
        where: { tenantId, status: 'open' },
        orderBy: { score: 'desc' },
        take: 30,
      }),
    ]);

    const fromDecisions: AvitoObservatoryItemDto[] = decisions.map((d) => ({
      id: d.id,
      kind: 'recommendation',
      severity: d.confidence > 0.8 ? 'warning' : 'info',
      title: `Decision: ${d.action}`,
      body: d.reason,
      entityType: d.entityType,
      entityId: d.entityId,
      source: 'decision_engine',
      createdAt: d.generatedAt.toISOString(),
      dismissed: false,
    }));

    const fromOpps: AvitoObservatoryItemDto[] = opportunities.map((o) => ({
      id: o.id,
      kind: 'opportunity',
      severity: o.score > 70 ? 'info' : 'info',
      title: `Opportunity: ${o.kind}`,
      body: o.reason,
      entityType: o.entityType,
      entityId: o.entityId,
      source: 'opportunity_engine',
      createdAt: o.detectedAt.toISOString(),
      dismissed: false,
    }));

    const fromStored: AvitoObservatoryItemDto[] = stored.map((s) => ({
      id: s.id,
      kind: s.kind as AvitoObservatoryItemDto['kind'],
      severity: s.severity as AvitoObservatoryItemDto['severity'],
      title: s.title,
      body: s.body,
      entityType: s.entityType,
      entityId: s.entityId,
      source: s.source,
      createdAt: s.createdAt.toISOString(),
      dismissed: s.dismissed,
    }));

    const seen = new Set<string>();
    const items = [...fromStored, ...fromDecisions, ...fromOpps].filter((i) => {
      const key = `${i.kind}:${i.entityType}:${i.entityId}:${i.title.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);

    const counts = {
      recommendations: items.filter((i) => i.kind === 'recommendation').length,
      warnings: items.filter((i) => i.kind === 'warning' || i.severity === 'warning').length,
      forecasts: items.filter((i) => i.kind === 'forecast').length,
      anomalies: items.filter((i) => i.kind === 'anomaly').length,
      opportunities: items.filter((i) => i.kind === 'opportunity').length,
    };

    return { items, counts };
  }

  async upsertItem(
    tenantId: string,
    input: {
      kind: string;
      severity: string;
      title: string;
      body: string;
      entityType: string | null;
      entityId: string | null;
      source: string;
      dedupeKey: string;
    },
  ) {
    return this.prisma.avitoObservatoryItemReadModel.upsert({
      where: { tenantId_dedupeKey: { tenantId, dedupeKey: input.dedupeKey } },
      create: {
        tenantId,
        kind: input.kind,
        severity: input.severity,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
        source: input.source,
        dedupeKey: input.dedupeKey,
        createdAt: new Date(),
      },
      update: {
        title: input.title,
        body: input.body,
        severity: input.severity,
      },
    });
  }

  async dismiss(tenantId: string, itemId: string) {
    return this.prisma.avitoObservatoryItemReadModel.updateMany({
      where: { id: itemId, tenantId },
      data: { dismissed: true },
    });
  }
}
