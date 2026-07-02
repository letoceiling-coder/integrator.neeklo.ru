import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AgentRole } from '@neeklo/contracts';
import { PrismaService } from '../../prisma/prisma.service';

export interface ResolvedAgent {
  id: string;
  name: string;
  role: string;
  version: string;
  skillIds: string[];
  toolNames: string[];
  systemPromptId: string | null;
  modelPreference: string | null;
}

/** Skill Framework — dynamic skill definitions. */
@Injectable()
export class SkillFrameworkService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const skills = [
      { skillId: 'sales', name: 'Sales', category: 'commerce', description: 'Negotiate and close deals', toolNames: ['decision.list', 'forecast.get'] },
      { skillId: 'support', name: 'Support', category: 'commerce', description: 'Customer support responses', toolNames: ['memory.recall'] },
      { skillId: 'listing', name: 'Listing', category: 'marketing', description: 'Optimize listings', toolNames: ['metrics.query', 'marketplace.search'] },
      { skillId: 'analytics', name: 'Analytics', category: 'intelligence', description: 'Data analysis', toolNames: ['metrics.query', 'forecast.get'] },
      { skillId: 'negotiation', name: 'Negotiation', category: 'commerce', description: 'Price negotiation', toolNames: ['decision.list'] },
    ];
    for (const s of skills) {
      await this.prisma.skillDefinitionReadModel.upsert({
        where: { skillId: s.skillId },
        create: { id: uuid(), ...s },
        update: { description: s.description, toolNames: s.toolNames },
      });
    }
  }

  list() {
    return this.prisma.skillDefinitionReadModel.findMany({ where: { enabled: true } });
  }

  async get(skillId: string) {
    return this.prisma.skillDefinitionReadModel.findUnique({ where: { skillId } });
  }
}

/** Agent Runtime — single agents, teams, hierarchies. */
@Injectable()
export class AgentRuntimeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(tenantId: string, agentId: string): Promise<ResolvedAgent | null> {
    const agent = await this.prisma.agentDefinitionReadModel.findFirst({
      where: { id: agentId, tenantId, enabled: true },
    });
    if (!agent) return null;
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      version: agent.version,
      skillIds: agent.skillIds,
      toolNames: agent.toolNames,
      systemPromptId: agent.systemPromptId,
      modelPreference: agent.modelPreference,
    };
  }

  async create(tenantId: string, input: {
    name: string;
    description?: string;
    role?: string;
    skillIds?: string[];
    toolNames?: string[];
    modelPreference?: string;
    systemPromptId?: string;
  }) {
    const id = uuid();
    await this.prisma.agentDefinitionReadModel.create({
      data: {
        id,
        tenantId,
        name: input.name,
        description: input.description ?? '',
        role: input.role ?? AgentRole.WORKER,
        skillIds: input.skillIds ?? [],
        toolNames: input.toolNames ?? [],
        modelPreference: input.modelPreference ?? null,
        systemPromptId: input.systemPromptId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return { id };
  }

  async recordRun(agentId: string): Promise<void> {
    await this.prisma.agentDefinitionReadModel.update({
      where: { id: agentId },
      data: { runCount: { increment: 1 } },
    });
  }

  list(tenantId: string) {
    return this.prisma.agentDefinitionReadModel.findMany({
      where: { tenantId, enabled: true },
      orderBy: { rating: 'desc' },
    });
  }
}

/** Agent Marketplace — catalog of available agents. */
@Injectable()
export class AgentMarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  catalog(tenantId: string) {
    return this.prisma.agentDefinitionReadModel.findMany({
      where: { tenantId, enabled: true },
      orderBy: [{ rating: 'desc' }, { runCount: 'desc' }],
    });
  }
}
