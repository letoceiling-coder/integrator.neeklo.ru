import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { IntelligenceEventType } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelligenceEventPublisher } from '../events/intelligence-event.publisher';

export type MemoryCategory =
  | 'preference'
  | 'behavior'
  | 'performance'
  | 'competition'
  | 'region'
  | 'strategy'
  | 'conversation'
  | 'general';

/**
 * AI Memory Engine — long-term structured memory so AI never starts analysis from zero.
 */
@Injectable()
export class AiMemoryEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: IntelligenceEventPublisher,
  ) {}

  async remember(
    tenantId: string,
    subjectKind: string,
    subjectId: string,
    category: MemoryCategory,
    content: string,
    facts: Record<string, unknown> = {},
    importance = 0.5,
  ): Promise<{ memoryId: string }> {
    const memoryId = uuid();
    await this.prisma.aiMemoryEntry.create({
      data: {
        tenantId,
        subjectKind,
        subjectId,
        category,
        content,
        facts,
        importance,
        recordedAt: new Date(),
      },
    });

    await this.publisher.publish(
      tenantId,
      `memory:${subjectKind}:${subjectId}`,
      IntelligenceEventType.MemoryRecorded,
      {
        memoryId,
        subjectKind,
        subjectId,
        category,
        content,
        recordedAt: new Date().toISOString(),
      },
    );

    return { memoryId };
  }

  async recall(
    tenantId: string,
    subjectKind: string,
    subjectId: string,
    category?: MemoryCategory,
    limit = 20,
  ): Promise<{ content: string; facts: Record<string, unknown>; category: string }[]> {
    const rows = await this.prisma.aiMemoryEntry.findMany({
      where: {
        tenantId,
        subjectKind,
        subjectId,
        ...(category ? { category } : {}),
      },
      orderBy: [{ importance: 'desc' }, { recordedAt: 'desc' }],
      take: limit,
    });

    await this.prisma.aiMemoryEntry.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { accessCount: { increment: 1 }, lastAccessAt: new Date() },
    });

    return rows.map((r) => ({
      content: r.content,
      facts: r.facts as Record<string, unknown>,
      category: r.category,
    }));
  }

  async buildContext(tenantId: string, subjectKind: string, subjectId: string): Promise<string> {
    const memories = await this.recall(tenantId, subjectKind, subjectId, undefined, 10);
    if (memories.length === 0) return '';
    return memories.map((m) => `[${m.category}] ${m.content}`).join('\n');
  }
}
