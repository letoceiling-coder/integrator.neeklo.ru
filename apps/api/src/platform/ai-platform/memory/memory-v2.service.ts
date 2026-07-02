import { Injectable } from '@nestjs/common';
import { MemoryTier } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AiMemoryEngine } from '../../intelligence/memory/ai-memory.engine';

/** Memory Engine v2 — multi-tier memory wrapping Stage 3 AiMemoryEngine. */
@Injectable()
export class MemoryV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly v1: AiMemoryEngine,
  ) {}

  async store(
    tenantId: string,
    tier: keyof typeof MemoryTier | string,
    subjectKind: string,
    subjectId: string,
    content: string,
    importance = 0.5,
  ): Promise<void> {
    const expiresAt =
      tier === MemoryTier.SHORT ? new Date(Date.now() + 3_600_000) : null;

    await this.prisma.aiMemoryV2Entry.create({
      data: {
        tenantId,
        tier,
        subjectKind,
        subjectId,
        content,
        importance,
        expiresAt,
        recordedAt: new Date(),
      },
    });

    if (tier === MemoryTier.LONG || tier === MemoryTier.CUSTOMER || tier === MemoryTier.BUSINESS) {
      await this.v1.remember(tenantId, subjectKind, subjectId, 'general', content, {}, importance);
    }
  }

  async buildContext(tenantId: string, context: Record<string, unknown>): Promise<string> {
    const subjectKind = (context.subjectKind as string) ?? 'tenant';
    const subjectId = (context.subjectId as string) ?? tenantId;

    const tiers = await this.prisma.aiMemoryV2Entry.findMany({
      where: {
        tenantId,
        subjectKind,
        subjectId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ importance: 'desc' }, { recordedAt: 'desc' }],
      take: 10,
    });

    const v1Ctx = await this.v1.buildContext(tenantId, subjectKind, subjectId);
    const v2Lines = tiers.map((t) => `[${t.tier}] ${t.content}`);

    return [...v2Lines, v1Ctx].filter(Boolean).join('\n');
  }
}
