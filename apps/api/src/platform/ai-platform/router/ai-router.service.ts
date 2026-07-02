import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiTaskType } from '@neeklo/contracts';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';

export interface RouteDecision {
  model: string;
  provider: string;
  taskType: AiTaskType;
  estimatedCostPer1kTokens: number;
  reason: string;
}

/**
 * AI Router — selects model by task type, cost, speed, and tenant limits.
 * Provider-agnostic; defaults via env, overridable per tenant via OrganizationReadModel.aiSettings.
 */
@Injectable()
export class AiRouterService {
  private readonly defaults: Record<AiTaskType, { envKey: keyof Env; provider: string; cost: number }> = {
    [AiTaskType.CHAT]: { envKey: 'AI_MODEL_CHAT', provider: 'openai', cost: 0.00015 },
    [AiTaskType.ANALYTICS]: { envKey: 'AI_MODEL_ANALYTICS', provider: 'anthropic', cost: 0.003 },
    [AiTaskType.LISTING]: { envKey: 'AI_MODEL_LISTING', provider: 'openai', cost: 0.005 },
    [AiTaskType.VISION]: { envKey: 'AI_MODEL_VISION', provider: 'qwen', cost: 0.002 },
    [AiTaskType.OCR]: { envKey: 'AI_MODEL_OCR', provider: 'mistral', cost: 0.0002 },
    [AiTaskType.SUMMARY]: { envKey: 'AI_MODEL_SUMMARY', provider: 'google', cost: 0.0001 },
    [AiTaskType.REASONING]: { envKey: 'AI_MODEL_ANALYTICS', provider: 'anthropic', cost: 0.003 },
    [AiTaskType.PLANNING]: { envKey: 'AI_MODEL_ANALYTICS', provider: 'anthropic', cost: 0.003 },
    [AiTaskType.TOOL]: { envKey: 'AI_MODEL_CHAT', provider: 'openai', cost: 0.00015 },
    [AiTaskType.EVALUATION]: { envKey: 'AI_MODEL_SUMMARY', provider: 'google', cost: 0.0001 },
  };

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  async route(tenantId: string, taskType: AiTaskType): Promise<RouteDecision> {
    const org = await this.prisma.organizationReadModel.findUnique({ where: { tenantId } });
    const settings = (org?.aiSettings ?? {}) as Record<string, string>;
    const def = this.defaults[taskType];
    const model = settings[`model_${taskType}`] ?? this.config.get(def.envKey, { infer: true });

    return {
      model,
      provider: model.split('/')[0] ?? def.provider,
      taskType,
      estimatedCostPer1kTokens: def.cost,
      reason: settings[`model_${taskType}`] ? 'tenant_override' : 'default_route',
    };
  }
}
