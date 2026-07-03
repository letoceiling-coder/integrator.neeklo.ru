import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiTaskType, type AvitoSmartReplyDto, type AvitoSmartReplyRequestDto } from '@neeklo/contracts';
import { AiGatewayService } from '../ai-platform/gateway/ai-gateway.service';
import { AvitoSalesAgentConfigService } from './avito-sales-agent-config.service';

@Injectable()
export class AvitoSmartRepliesService {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly config: AvitoSalesAgentConfigService,
  ) {}

  async generate(tenantId: string, dto: AvitoSmartReplyRequestDto): Promise<AvitoSmartReplyDto[]> {
    const cfg = dto.accountId ? await this.config.get(tenantId, dto.accountId) : null;
    const tones = ['professional', 'friendly', 'concise', 'persuasive', 'empathetic'];

    const result = await this.gateway.executeWithContext(
      {
        taskType: AiTaskType.CHAT,
        input: `Customer message: "${dto.message}"\nGenerate exactly 5 reply variants for Avito sales chat. Tone base: ${cfg?.tone ?? 'professional'}. Return JSON array: [{"text":"...","tone":"..."}]`,
        skillIds: ['sales', 'negotiation'],
        context: { entityType: 'conversation', entityId: dto.conversationId, customerId: dto.customerId },
        maxSteps: 3,
      },
      { tenantId, actorId: null, correlationId: dto.conversationId, runId: uuid() },
    );

    try {
      const parsed = JSON.parse(result.output.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as { text: string; tone?: string }[];
      if (parsed.length >= 1) {
        return parsed.slice(0, 5).map((p, i) => ({
          id: uuid(),
          text: p.text,
          tone: p.tone ?? tones[i] ?? 'professional',
          confidence: 0.75 + i * 0.02,
        }));
      }
    } catch {
      /* fallback below */
    }

    return tones.map((tone, i) => ({
      id: uuid(),
      text: `[${tone}] ${result.output.slice(0, 200 + i * 20)}`,
      tone,
      confidence: 0.7,
    }));
  }
}
