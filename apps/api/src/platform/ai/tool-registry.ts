import { Injectable, Logger } from '@nestjs/common';
import type { z } from 'zod';
import { NotFoundError } from '@neeklo/kernel';

/**
 * An AI-callable tool. Agents discover tools from the registry and invoke them by name with
 * arguments validated against `parameters`. This is how the Agent Engine gains real capabilities
 * (read analytics, change a price, draft a reply) in a type-safe, auditable way.
 */
export interface AiTool<TParams extends z.ZodTypeAny = z.ZodTypeAny, TResult = unknown> {
  name: string;
  description: string;
  parameters: TParams;
  execute(args: z.infer<TParams>, ctx: AiToolContext): Promise<TResult>;
}

export interface AiToolContext {
  tenantId: string;
  actorId: string | null;
  correlationId: string;
}

export const AI_TOOL = Symbol('AI_TOOL');

/**
 * Central registry of AI tools. Modules provide tools under the `AI_TOOL` multi-token; the
 * Agent Engine lists them, exposes their JSON schema to the model, and dispatches calls here.
 */
@Injectable()
export class AiToolRegistry {
  private readonly logger = new Logger(AiToolRegistry.name);
  private readonly tools = new Map<string, AiTool>();

  register(tool: AiTool): void {
    this.tools.set(tool.name, tool);
    this.logger.log(`Registered AI tool: ${tool.name}`);
  }

  list(): AiTool[] {
    return [...this.tools.values()];
  }

  async invoke(name: string, args: unknown, ctx: AiToolContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new NotFoundError('AiTool', name);
    const parsed = tool.parameters.parse(args);
    return tool.execute(parsed, ctx);
  }
}
