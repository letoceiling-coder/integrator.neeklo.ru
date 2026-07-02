import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiEventType, AiTaskType } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AiEventPublisher } from '../events/ai-event.publisher';

const DEFAULT_PROMPTS: Record<string, { category: string; template: string }> = {
  chat: { category: 'sales', template: 'You are a professional marketplace sales agent for NEEKLO.' },
  analytics: { category: 'analytics', template: 'Analyze marketplace data and provide actionable insights.' },
  listing: { category: 'marketing', template: 'Generate optimized marketplace listing content.' },
  summary: { category: 'support', template: 'Summarize the conversation concisely for a manager.' },
  reasoning: { category: 'reasoning', template: 'Apply structured reasoning using provided context.' },
};

/** Prompt Registry — versioned prompts outside code. */
@Injectable()
export class PromptRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: AiEventPublisher,
  ) {}

  async resolve(tenantId: string, taskType: AiTaskType, promptId?: string) {
    if (promptId) {
      const p = await this.prisma.promptRegistryEntry.findUnique({ where: { id: promptId } });
      if (p?.active) return p;
    }

    const byName = await this.prisma.promptRegistryEntry.findFirst({
      where: { tenantId, name: taskType, active: true },
      orderBy: { version: 'desc' },
    });
    if (byName) return byName;

    const def = DEFAULT_PROMPTS[taskType] ?? DEFAULT_PROMPTS.chat!;
    return { id: 'default', name: taskType, version: '1.0.0', template: def.template, category: def.category };
  }

  async create(tenantId: string, name: string, category: string, template: string, tags: string[] = []) {
    const id = uuid();
    await this.prisma.promptRegistryEntry.create({
      data: { id, tenantId, name, category, template, tags, createdAt: new Date(), updatedAt: new Date() },
    });
    return { id };
  }

  list(tenantId: string) {
    return this.prisma.promptRegistryEntry.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
  }

  async recordUsage(tenantId: string, runId: string, promptId: string, version: string, tokensIn: number) {
    await this.publisher.publish(tenantId, `runs:${runId}`, AiEventType.PromptUsed, {
      runId,
      promptId,
      promptVersion: version,
      tokensIn,
      usedAt: new Date().toISOString(),
    });
  }
}
