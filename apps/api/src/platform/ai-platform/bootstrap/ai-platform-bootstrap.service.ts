import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { z } from 'zod';
import { ToolRuntimeService } from '../tools/tool-runtime.service';
import { SearchEngine } from '../../commerce/commerce-services';
import { ForecastEngine } from '../../intelligence/forecast/forecast.engine';
import { DecisionEngine } from '../../intelligence/decision/decision.engine';
import { AiMemoryEngine } from '../../intelligence/memory/ai-memory.engine';

/** Seeds builtin tools at bootstrap. Skills seed via SkillFrameworkService lifecycle. */
@Injectable()
export class AiPlatformBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiPlatformBootstrapService.name);

  constructor(
    private readonly tools: ToolRuntimeService,
    private readonly search: SearchEngine,
    private readonly forecast: ForecastEngine,
    private readonly decision: DecisionEngine,
    private readonly memory: AiMemoryEngine,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.tools.registerTool({
      name: 'search.global',
      description: 'Search across ads, customers, conversations',
      parameters: z.object({ q: z.string(), tenantId: z.string() }),
      execute: async (args, ctx) => this.search.search(ctx.tenantId, args.q),
    });

    this.tools.registerTool({
      name: 'forecast.get',
      description: 'Get latest forecast for an ad',
      parameters: z.object({ adId: z.string() }),
      execute: async (args, ctx) => this.forecast.getLatest(ctx.tenantId, 'ad', args.adId),
    });

    this.tools.registerTool({
      name: 'decision.list',
      description: 'List pending AI decisions',
      parameters: z.object({ entityType: z.string().optional(), entityId: z.string().optional() }),
      execute: async (args, ctx) =>
        this.decision.listPending(ctx.tenantId, args.entityType, args.entityId),
    });

    this.tools.registerTool({
      name: 'memory.recall',
      description: 'Recall memory for a subject',
      parameters: z.object({ subjectKind: z.string(), subjectId: z.string() }),
      execute: async (args, ctx) => this.memory.recall(ctx.tenantId, args.subjectKind, args.subjectId),
    });

    this.tools.registerTool({
      name: 'mcp.bridge',
      description: 'MCP tool bridge (plugin adapter stub)',
      parameters: z.object({ server: z.string(), tool: z.string(), payload: z.record(z.unknown()).default({}) }),
      execute: async (args) => ({ ok: true, stub: true, server: args.server, tool: args.tool }),
    });

    this.logger.log('AI Platform bootstrap complete — tools registered');
  }
}
