import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiToolRegistry, type AiTool, type AiToolContext } from '../../ai/tool-registry';
import { PrismaService } from '../../prisma/prisma.service';
import { AiEventPublisher } from '../events/ai-event.publisher';
import { AiEventType } from '@neeklo/contracts';

export interface ToolRuntimeContext extends AiToolContext {
  runId: string;
}

/** Tool Registry v2 — versioned, categorized, with health and cost metadata. */
@Injectable()
export class ToolRegistryV2Service implements OnApplicationBootstrap {
  private readonly logger = new Logger(ToolRegistryV2Service.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedBuiltins();
  }

  async register(entry: {
    name: string;
    version?: string;
    category: string;
    description: string;
    permissions?: string[];
    costPerCall?: number;
    dependencies?: string[];
  }): Promise<void> {
    await this.prisma.toolRegistryEntry.upsert({
      where: { name: entry.name },
      create: {
        id: uuid(),
        name: entry.name,
        version: entry.version ?? '1.0.0',
        category: entry.category,
        description: entry.description,
        permissions: entry.permissions ?? [],
        costPerCall: entry.costPerCall ?? 0,
        dependencies: entry.dependencies ?? [],
        createdAt: new Date(),
      },
      update: {
        description: entry.description,
        category: entry.category,
        healthy: true,
      },
    });
  }

  list(category?: string) {
    return this.prisma.toolRegistryEntry.findMany({
      where: { enabled: true, ...(category ? { category } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  private async seedBuiltins(): Promise<void> {
    const builtins = [
      { name: 'marketplace.search', category: 'marketplace', description: 'Search listings via Marketplace SDK' },
      { name: 'forecast.get', category: 'forecast', description: 'Get forecast for entity' },
      { name: 'decision.list', category: 'decision', description: 'List pending decisions' },
      { name: 'metrics.query', category: 'analytics', description: 'Query metrics warehouse' },
      { name: 'memory.recall', category: 'memory', description: 'Recall AI memory' },
      { name: 'notification.send', category: 'notification', description: 'Send notification' },
      { name: 'search.global', category: 'search', description: 'Global search' },
      { name: 'budget.summary', category: 'budget', description: 'Budget center summary' },
      { name: 'mcp.bridge', category: 'integration', description: 'MCP tool bridge (stub)' },
    ];
    for (const b of builtins) {
      await this.register(b);
    }
    this.logger.log(`Seeded ${builtins.length} builtin tools`);
  }
}

/** Tool Runtime — plugin-style execution with telemetry. */
@Injectable()
export class ToolRuntimeService {
  constructor(
    private readonly registry: AiToolRegistry,
    private readonly registryV2: ToolRegistryV2Service,
    private readonly publisher: AiEventPublisher,
  ) {}

  registerTool(tool: AiTool): void {
    this.registry.register(tool);
    void this.registryV2.register({
      name: tool.name,
      category: 'custom',
      description: tool.description,
    });
  }

  listTools() {
    return this.registry.list();
  }

  async invoke(name: string, args: unknown, ctx: ToolRuntimeContext): Promise<unknown> {
    const started = Date.now();
    let success = true;
    try {
      return await this.registry.invoke(name, args, ctx);
    } catch (e) {
      success = false;
      throw e;
    } finally {
      await this.publisher.publish(ctx.tenantId, `runs:${ctx.runId}`, AiEventType.ToolInvoked, {
        runId: ctx.runId,
        toolName: name,
        toolVersion: '1.0.0',
        durationMs: Date.now() - started,
        success,
        invokedAt: new Date().toISOString(),
      });
    }
  }
}
